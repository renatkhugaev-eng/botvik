/**
 * Sentry Alerts Setup Script
 * 
 * Автоматически создаёт алерты в Sentry через API
 * 
 * Использование:
 *   npx ts-node scripts/setup-sentry-alerts.ts
 */

const SENTRY_AUTH_TOKEN = process.env.SENTRY_AUTH_TOKEN;
const SENTRY_ORG = process.env.SENTRY_ORG || "botvik";
const SENTRY_PROJECT = process.env.SENTRY_PROJECT || "javascript-nextjs";

const SENTRY_API = "https://sentry.io/api/0";

interface AlertRule {
  name: string;
  conditions: Array<{
    id: string;
    interval?: string;
    value?: number;
    name?: string;
  }>;
  actions: Array<{
    id: string;
    targetType?: string;
    targetIdentifier?: string;
    fallthroughType?: string;
  }>;
  actionMatch: "all" | "any" | "none";
  filterMatch: "all" | "any" | "none";
  frequency: number;
  environment?: string;
}

const alertRules: AlertRule[] = [
  {
    name: "[Botvik] 🆕 New Issue Created",
    conditions: [
      {
        id: "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition",
        name: "A new issue is created",
      },
    ],
    actions: [
      {
        id: "sentry.mail.actions.NotifyEmailAction",
        targetType: "IssueOwners",
        fallthroughType: "ActiveMembers",
      },
    ],
    actionMatch: "all",
    filterMatch: "all",
    frequency: 30, // minutes
  },
  {
    name: "[Botvik] 🔥 High Error Rate (>10 in 5 min)",
    conditions: [
      {
        id: "sentry.rules.conditions.event_frequency.EventFrequencyCondition",
        interval: "5m",
        value: 10,
      },
    ],
    actions: [
      {
        id: "sentry.mail.actions.NotifyEmailAction",
        targetType: "IssueOwners",
        fallthroughType: "ActiveMembers",
      },
    ],
    actionMatch: "all",
    filterMatch: "all",
    frequency: 30,
  },
  {
    name: "[Botvik] 👥 Many Users Affected (>5 in 1 hour)",
    conditions: [
      {
        id: "sentry.rules.conditions.event_frequency.EventUniqueUserFrequencyCondition",
        interval: "1h",
        value: 5,
      },
    ],
    actions: [
      {
        id: "sentry.mail.actions.NotifyEmailAction",
        targetType: "IssueOwners",
        fallthroughType: "ActiveMembers",
      },
    ],
    actionMatch: "all",
    filterMatch: "all",
    frequency: 60,
  },
  {
    name: "[Botvik] 🔄 Regression Detected",
    conditions: [
      {
        id: "sentry.rules.conditions.regression_event.RegressionEventCondition",
        name: "The issue changes state from resolved to unresolved",
      },
    ],
    actions: [
      {
        id: "sentry.mail.actions.NotifyEmailAction",
        targetType: "IssueOwners",
        fallthroughType: "ActiveMembers",
      },
    ],
    actionMatch: "all",
    filterMatch: "all",
    frequency: 30,
  },
];

async function createAlertRule(rule: AlertRule): Promise<boolean> {
  const url = `${SENTRY_API}/projects/${SENTRY_ORG}/${SENTRY_PROJECT}/rules/`;
  
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SENTRY_AUTH_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(rule),
    });

    if (response.ok) {
      console.log(`✅ Created: ${rule.name}`);
      return true;
    } else {
      const error = await response.json();
      console.error(`❌ Failed: ${rule.name}`, error);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error creating ${rule.name}:`, error);
    return false;
  }
}

async function listExistingRules(): Promise<string[]> {
  const url = `${SENTRY_API}/projects/${SENTRY_ORG}/${SENTRY_PROJECT}/rules/`;
  
  try {
    const response = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${SENTRY_AUTH_TOKEN}`,
      },
    });

    if (response.ok) {
      const rules = await response.json();
      return rules.map((r: { name: string }) => r.name);
    }
  } catch (error) {
    console.error("Failed to fetch existing rules:", error);
  }
  return [];
}

async function getProjects(): Promise<void> {
  const url = `${SENTRY_API}/organizations/${SENTRY_ORG}/projects/`;
  
  try {
    const response = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${SENTRY_AUTH_TOKEN}`,
      },
    });

    if (response.ok) {
      const projects = await response.json();
      console.log("\n📁 Available projects:");
      projects.forEach((p: { slug: string; name: string }) => {
        console.log(`   - ${p.slug} (${p.name})`);
      });
    } else {
      const error = await response.json();
      console.error("Failed to fetch projects:", error);
    }
  } catch (error) {
    console.error("Error fetching projects:", error);
  }
}

async function main() {
  console.log("🔧 Sentry Alerts Setup\n");
  console.log(`Organization: ${SENTRY_ORG}`);
  console.log(`Project: ${SENTRY_PROJECT}`);
  console.log("");

  if (!SENTRY_AUTH_TOKEN) {
    console.error("❌ SENTRY_AUTH_TOKEN is not set!");
    console.log("\nSet it with:");
    console.log('  export SENTRY_AUTH_TOKEN="your-token"');
    process.exit(1);
  }

  // Show available projects
  await getProjects();
  console.log("");

  // Get existing rules to avoid duplicates
  const existingRules = await listExistingRules();
  console.log(`\n📋 Existing rules: ${existingRules.length}`);
  existingRules.forEach(name => console.log(`   - ${name}`));
  console.log("");

  // Create new rules
  console.log("🚀 Creating alert rules...\n");
  
  let created = 0;
  let skipped = 0;

  for (const rule of alertRules) {
    if (existingRules.includes(rule.name)) {
      console.log(`⏭️  Skipped (exists): ${rule.name}`);
      skipped++;
    } else {
      const success = await createAlertRule(rule);
      if (success) created++;
    }
  }

  console.log("\n" + "═".repeat(50));
  console.log(`✅ Created: ${created}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log("═".repeat(50));
  console.log("\n🎉 Done! Check your Sentry dashboard.");
}

main().catch(console.error);

