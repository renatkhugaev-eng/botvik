/**
 * Posthog Dashboards Setup Script
 * 
 * Автоматически создаёт дашборды и инсайты в Posthog через API
 * 
 * Использование:
 *   export POSTHOG_API_KEY="phx_xxx"
 *   npx ts-node scripts/setup-posthog-dashboards.ts
 */

const POSTHOG_API_KEY = process.env.POSTHOG_API_KEY;
const POSTHOG_PROJECT_ID = process.env.POSTHOG_PROJECT_ID || ""; // Will be fetched
const POSTHOG_HOST = process.env.POSTHOG_HOST || "https://eu.i.posthog.com";

const API_BASE = `${POSTHOG_HOST}/api`;

interface Insight {
  name: string;
  query: {
    kind: string;
    source?: object;
    series?: Array<{
      event: string;
      kind?: string;
      math?: string;
      name?: string;
    }>;
    interval?: string;
    trendsFilter?: object;
    funnelsFilter?: object;
    retentionFilter?: object;
    dateRange?: {
      date_from: string;
    };
  };
}

const insights: Insight[] = [
  // ═══════════════════════════════════════════════════════════════════
  // TRENDS
  // ═══════════════════════════════════════════════════════════════════
  {
    name: "📊 DAU (Daily Active Users)",
    query: {
      kind: "TrendsQuery",
      series: [
        {
          event: "$pageview",
          kind: "EventsNode",
          math: "dau",
          name: "Daily Active Users",
        },
      ],
      interval: "day",
      dateRange: { date_from: "-30d" },
      trendsFilter: { display: "ActionsLineGraph" },
    },
  },
  {
    name: "🎮 Quiz Completions",
    query: {
      kind: "TrendsQuery",
      series: [
        {
          event: "quiz_completed",
          kind: "EventsNode",
          math: "total",
          name: "Quiz Completions",
        },
      ],
      interval: "day",
      dateRange: { date_from: "-30d" },
      trendsFilter: { display: "ActionsLineGraph" },
    },
  },
  {
    name: "⚔️ Duels Activity",
    query: {
      kind: "TrendsQuery",
      series: [
        {
          event: "duel_created",
          kind: "EventsNode",
          math: "total",
          name: "Duels Created",
        },
        {
          event: "duel_completed",
          kind: "EventsNode",
          math: "total",
          name: "Duels Completed",
        },
      ],
      interval: "day",
      dateRange: { date_from: "-30d" },
      trendsFilter: { display: "ActionsLineGraph" },
    },
  },
  {
    name: "💰 Purchases",
    query: {
      kind: "TrendsQuery",
      series: [
        {
          event: "purchase_completed",
          kind: "EventsNode",
          math: "total",
          name: "Purchases",
        },
      ],
      interval: "day",
      dateRange: { date_from: "-30d" },
      trendsFilter: { display: "ActionsLineGraph" },
    },
  },
  {
    name: "🏆 Tournament Joins",
    query: {
      kind: "TrendsQuery",
      series: [
        {
          event: "tournament_joined",
          kind: "EventsNode",
          math: "total",
          name: "Tournament Joins",
        },
      ],
      interval: "day",
      dateRange: { date_from: "-30d" },
      trendsFilter: { display: "ActionsLineGraph" },
    },
  },
  {
    name: "🎁 Daily Rewards Claimed",
    query: {
      kind: "TrendsQuery",
      series: [
        {
          event: "daily_reward_claimed",
          kind: "EventsNode",
          math: "total",
          name: "Daily Rewards",
        },
      ],
      interval: "day",
      dateRange: { date_from: "-30d" },
      trendsFilter: { display: "ActionsLineGraph" },
    },
  },
  {
    name: "📈 Level Ups",
    query: {
      kind: "TrendsQuery",
      series: [
        {
          event: "level_up",
          kind: "EventsNode",
          math: "total",
          name: "Level Ups",
        },
      ],
      interval: "day",
      dateRange: { date_from: "-30d" },
      trendsFilter: { display: "ActionsLineGraph" },
    },
  },
  {
    name: "🔗 Referrals Used",
    query: {
      kind: "TrendsQuery",
      series: [
        {
          event: "referral_used",
          kind: "EventsNode",
          math: "total",
          name: "Referrals",
        },
      ],
      interval: "day",
      dateRange: { date_from: "-30d" },
      trendsFilter: { display: "ActionsLineGraph" },
    },
  },
  // ═══════════════════════════════════════════════════════════════════
  // FUNNELS
  // ═══════════════════════════════════════════════════════════════════
  {
    name: "🎯 Quiz Funnel: Start → Complete",
    query: {
      kind: "FunnelsQuery",
      series: [
        { event: "quiz_started", kind: "EventsNode" },
        { event: "quiz_completed", kind: "EventsNode" },
      ],
      dateRange: { date_from: "-30d" },
      funnelsFilter: {
        funnelVizType: "steps",
      },
    },
  },
  {
    name: "🛒 Purchase Funnel: View → Start → Complete",
    query: {
      kind: "FunnelsQuery",
      series: [
        { event: "shop_item_viewed", kind: "EventsNode" },
        { event: "purchase_started", kind: "EventsNode" },
        { event: "purchase_completed", kind: "EventsNode" },
      ],
      dateRange: { date_from: "-30d" },
      funnelsFilter: {
        funnelVizType: "steps",
      },
    },
  },
];

async function getProjectId(): Promise<string | null> {
  try {
    const response = await fetch(`${API_BASE}/projects/`, {
      headers: {
        Authorization: `Bearer ${POSTHOG_API_KEY}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      if (data.results && data.results.length > 0) {
        return data.results[0].id.toString();
      }
    } else {
      const error = await response.json();
      console.error("Failed to fetch projects:", error);
    }
  } catch (error) {
    console.error("Error fetching projects:", error);
  }
  return null;
}

async function createDashboard(projectId: string, name: string): Promise<number | null> {
  try {
    const response = await fetch(`${API_BASE}/projects/${projectId}/dashboards/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${POSTHOG_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        description: "Auto-generated dashboard for Botvik monitoring",
        pinned: true,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Dashboard created: ${name} (ID: ${data.id})`);
      return data.id;
    } else {
      const error = await response.json();
      console.error(`❌ Failed to create dashboard:`, error);
    }
  } catch (error) {
    console.error("Error creating dashboard:", error);
  }
  return null;
}

async function createInsight(
  projectId: string,
  dashboardId: number,
  insight: Insight
): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/projects/${projectId}/insights/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${POSTHOG_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: insight.name,
        query: insight.query,
        dashboards: [dashboardId],
      }),
    });

    if (response.ok) {
      console.log(`   ✅ ${insight.name}`);
      return true;
    } else {
      const error = await response.json();
      console.error(`   ❌ ${insight.name}:`, error.detail || error);
      return false;
    }
  } catch (error) {
    console.error(`   ❌ ${insight.name}:`, error);
    return false;
  }
}

async function main() {
  console.log("🔧 Posthog Dashboards Setup\n");
  console.log(`Host: ${POSTHOG_HOST}`);
  console.log("");

  if (!POSTHOG_API_KEY) {
    console.error("❌ POSTHOG_API_KEY is not set!");
    console.log("\nGet your Personal API Key from:");
    console.log("  Posthog → Settings → Personal API Keys → Create Key");
    console.log("\nThen run:");
    console.log('  export POSTHOG_API_KEY="phx_xxx"');
    console.log("  npx ts-node scripts/setup-posthog-dashboards.ts");
    process.exit(1);
  }

  // Get project ID
  console.log("📁 Fetching project...");
  const projectId = await getProjectId();
  
  if (!projectId) {
    console.error("❌ Could not find project. Check your API key.");
    process.exit(1);
  }
  
  console.log(`   Project ID: ${projectId}\n`);

  // Create main dashboard
  console.log("📊 Creating dashboard...");
  const dashboardId = await createDashboard(projectId, "🎮 Botvik Analytics");
  
  if (!dashboardId) {
    console.error("❌ Failed to create dashboard");
    process.exit(1);
  }

  // Create insights
  console.log("\n📈 Creating insights...\n");
  
  let created = 0;
  let failed = 0;

  for (const insight of insights) {
    const success = await createInsight(projectId, dashboardId, insight);
    if (success) created++;
    else failed++;
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log("\n" + "═".repeat(50));
  console.log(`✅ Created: ${created} insights`);
  console.log(`❌ Failed: ${failed}`);
  console.log("═".repeat(50));
  console.log(`\n🎉 Done! View your dashboard at:`);
  console.log(`   ${POSTHOG_HOST}/dashboard/${dashboardId}`);
}

main().catch(console.error);

