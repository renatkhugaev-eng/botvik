import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  
  const quizTitle = searchParams.get("title") || "True Crime Quiz";
  const score = parseInt(searchParams.get("score") || "0", 10);
  const correct = parseInt(searchParams.get("correct") || "0", 10);
  const total = parseInt(searchParams.get("total") || "10", 10);
  const streak = parseInt(searchParams.get("streak") || "0", 10);
  const stars = parseInt(searchParams.get("stars") || "3", 10);
  const player = searchParams.get("player") || "";
  
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(135deg, #0f0f1a 0%, #1a1025 50%, #0a0a0f 100%)",
          fontFamily: "Inter, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background glow effects */}
        <div
          style={{
            position: "absolute",
            left: -80,
            top: -80,
            width: 280,
            height: 280,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(139, 92, 246, 0.4) 0%, transparent 70%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: -80,
            bottom: -80,
            width: 280,
            height: 280,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(236, 72, 153, 0.3) 0%, transparent 70%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "40%",
            top: "30%",
            width: 200,
            height: 200,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(59, 130, 246, 0.2) 0%, transparent 70%)",
          }}
        />

        {/* Corner decorations */}
        <div
          style={{
            position: "absolute",
            top: 20,
            left: 20,
            width: 40,
            height: 40,
            borderLeft: "3px solid rgba(139, 92, 246, 0.4)",
            borderTop: "3px solid rgba(139, 92, 246, 0.4)",
            borderTopLeftRadius: 12,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 20,
            right: 20,
            width: 40,
            height: 40,
            borderRight: "3px solid rgba(139, 92, 246, 0.4)",
            borderTop: "3px solid rgba(139, 92, 246, 0.4)",
            borderTopRightRadius: 12,
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: 20,
            left: 20,
            width: 40,
            height: 40,
            borderLeft: "3px solid rgba(236, 72, 153, 0.4)",
            borderBottom: "3px solid rgba(236, 72, 153, 0.4)",
            borderBottomLeftRadius: 12,
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: 20,
            right: 20,
            width: 40,
            height: 40,
            borderRight: "3px solid rgba(236, 72, 153, 0.4)",
            borderBottom: "3px solid rgba(236, 72, 153, 0.4)",
            borderBottomRightRadius: 12,
          }}
        />

        {/* Content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            padding: 48,
          }}
        >
          {/* Quiz title pill */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              backgroundColor: "rgba(255, 255, 255, 0.1)",
              borderRadius: 50,
              padding: "12px 24px",
              marginBottom: 16,
            }}
          >
            <span style={{ fontSize: 24 }}>🔍</span>
            <span style={{ color: "rgba(255, 255, 255, 0.9)", fontWeight: 600, fontSize: 20 }}>
              {quizTitle}
            </span>
          </div>

          {/* Player name */}
          {player && (
            <p style={{ color: "rgba(255, 255, 255, 0.5)", fontSize: 18, marginBottom: 24 }}>
              Результат игрока {player}
            </p>
          )}

          {/* Stars */}
          <div style={{ display: "flex", gap: 16, marginBottom: 40 }}>
            {[1, 2, 3, 4, 5].map((star) => (
              <span
                key={star}
                style={{
                  fontSize: 48,
                  opacity: star <= stars ? 1 : 0.2,
                  filter: star <= stars ? "drop-shadow(0 0 12px rgba(251, 191, 36, 0.7))" : "grayscale(1)",
                }}
              >
                ⭐
              </span>
            ))}
          </div>

          {/* Score block */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              borderRadius: 32,
              padding: "40px 64px",
              marginBottom: 40,
              background: "linear-gradient(135deg, rgba(139, 92, 246, 0.25) 0%, rgba(236, 72, 153, 0.25) 100%)",
              border: "2px solid rgba(255, 255, 255, 0.1)",
            }}
          >
            <p
              style={{
                color: "rgba(255, 255, 255, 0.5)",
                fontSize: 16,
                textTransform: "uppercase",
                letterSpacing: 4,
                marginBottom: 12,
              }}
            >
              Результат
            </p>
            <p
              style={{
                fontSize: 80,
                fontWeight: 900,
                background: "linear-gradient(135deg, #fff 0%, #c4b5fd 50%, #f9a8d4 100%)",
                backgroundClip: "text",
                color: "transparent",
                lineHeight: 1,
                marginBottom: 8,
              }}
            >
              {score.toLocaleString()}
            </p>
            <p style={{ color: "rgba(255, 255, 255, 0.5)", fontSize: 18 }}>очков</p>
          </div>

          {/* Stats row */}
          <div
            style={{
              display: "flex",
              gap: 48,
              marginBottom: 48,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <p style={{ fontSize: 32, fontWeight: 700, color: "#ffffff", marginBottom: 4 }}>
                {correct}/{total}
              </p>
              <p style={{ color: "rgba(255, 255, 255, 0.5)", fontSize: 14 }}>верных</p>
            </div>
            <div style={{ width: 2, backgroundColor: "rgba(255, 255, 255, 0.15)", height: 50 }} />
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <p style={{ fontSize: 32, fontWeight: 700, color: "#34d399", marginBottom: 4 }}>
                {accuracy}%
              </p>
              <p style={{ color: "rgba(255, 255, 255, 0.5)", fontSize: 14 }}>точность</p>
            </div>
            <div style={{ width: 2, backgroundColor: "rgba(255, 255, 255, 0.15)", height: 50 }} />
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <p style={{ fontSize: 32, fontWeight: 700, color: "#fbbf24", marginBottom: 4 }}>
                🔥 {streak}
              </p>
              <p style={{ color: "rgba(255, 255, 255, 0.5)", fontSize: 14 }}>серия</p>
            </div>
          </div>

          {/* Footer */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <p style={{ color: "rgba(255, 255, 255, 0.7)", fontSize: 18, marginBottom: 16 }}>
              💀 Попробуй побить мой рекорд!
            </p>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                backgroundColor: "rgba(139, 92, 246, 0.3)",
                borderRadius: 50,
                padding: "12px 24px",
              }}
            >
              <span style={{ fontSize: 20 }}>✈️</span>
              <span style={{ color: "#c4b5fd", fontSize: 18, fontWeight: 600 }}>@truecrimetg_bot</span>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 600,
      height: 800,
    }
  );
}

