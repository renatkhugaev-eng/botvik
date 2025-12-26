"use client";

/**
 * Тестовая страница панорамы — только GooglePanorama без overlay'ев
 */

import { useRouter } from "next/navigation";
import { GooglePanorama } from "@/components/panorama";

export default function PanoramaTestPage() {
  const router = useRouter();
  
  return (
    <div className="h-screen bg-black flex flex-col">
      {/* Simple back button */}
      <div className="p-4 bg-black/50 z-10">
        <button
          onClick={() => router.back()}
          className="px-4 py-2 bg-white/20 rounded-lg text-white text-sm"
        >
          ← Назад
        </button>
      </div>
      
      {/* Just the panorama - nothing else */}
      <div className="flex-1">
        <GooglePanorama
          coordinates={[40.758, -73.9855]}
          direction={[0, 0]}
          allowNavigation={true}
          className="w-full h-full"
        />
      </div>
    </div>
  );
}

