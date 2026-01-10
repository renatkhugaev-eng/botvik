"use client";

import { useRef } from "react";
import Lottie, { LottieRefCurrentProps } from "lottie-react";

// Import all icon animations
// Gaming
import gamepadAnimation from "@/public/animations/icons/gamepad.json";
import gameShieldAnimation from "@/public/animations/icons/game_shield.json";
import videoGameAnimation from "@/public/animations/icons/video_game.json";
import multiplayerAnimation from "@/public/animations/icons/multiplayer.json";
import gamingPlayerAnimation from "@/public/animations/icons/gaming_player.json";
import gamingWheelAnimation from "@/public/animations/icons/gaming_wheel.json";
import consoleAnimation from "@/public/animations/icons/console.json";
import virtualRealityAnimation from "@/public/animations/icons/virtual_reality.json";
import headphoneAnimation from "@/public/animations/icons/headphone.json";

// Awards
import trophyAnimation from "@/public/animations/icons/trophy.json";
import trophy2Animation from "@/public/animations/icons/trophy2.json";
import medalAnimation from "@/public/animations/icons/medal.json";
import medal2Animation from "@/public/animations/icons/medal2.json";
import awardAnimation from "@/public/animations/icons/award.json";
import badgeAnimation from "@/public/animations/icons/badge.json";
import certificateAnimation from "@/public/animations/icons/certificate.json";
import certificate2Animation from "@/public/animations/icons/certificate2.json";

// Finance
import walletAnimation from "@/public/animations/icons/wallet.json";
import moneyAnimation from "@/public/animations/icons/money.json";
import growthAnimation from "@/public/animations/icons/growth.json";
import planningAnimation from "@/public/animations/icons/planning.json";
import savingsAnimation from "@/public/animations/icons/savings.json";
import investmentAnimation from "@/public/animations/icons/investment.json";
import loanAnimation from "@/public/animations/icons/loan.json";
import bitcoinAnimation from "@/public/animations/icons/bitcoin.json";
import ethereumAnimation from "@/public/animations/icons/ethereum.json";

// Web Design
import targetAnimation from "@/public/animations/icons/target.json";
import rocketAnimation from "@/public/animations/icons/rocket.json";
import networkAnimation from "@/public/animations/icons/network.json";
import ideasAnimation from "@/public/animations/icons/ideas.json";
import securityAnimation from "@/public/animations/icons/security.json";
import serverAnimation from "@/public/animations/icons/server.json";
import indicatorAnimation from "@/public/animations/icons/indicator.json";
import applicationAnimation from "@/public/animations/icons/application.json";

// Communication
import chatAnimation from "@/public/animations/icons/chat.json";
import messagingAnimation from "@/public/animations/icons/messaging.json";
import phoneAnimation from "@/public/animations/icons/phone.json";
import discussionAnimation from "@/public/animations/icons/discussion.json";
import conferenceAnimation from "@/public/animations/icons/conference.json";
import onlineForumAnimation from "@/public/animations/icons/online_forum.json";
import microphoneAnimation from "@/public/animations/icons/microphone.json";
import radioAnimation from "@/public/animations/icons/radio.json";

// Shopping
import shoppingBagAnimation from "@/public/animations/icons/shopping_bag.json";
import cartAnimation from "@/public/animations/icons/cart.json";
import tagAnimation from "@/public/animations/icons/tag.json";
import voucherAnimation from "@/public/animations/icons/voucher.json";
import boxDiscountAnimation from "@/public/animations/icons/box_discount.json";
import bestsellerAnimation from "@/public/animations/icons/bestseller.json";
import ticketsAnimation from "@/public/animations/icons/tickets.json";

// Map of available icons
const iconAnimations = {
  // Gaming
  gamepad: gamepadAnimation,
  game_shield: gameShieldAnimation,
  video_game: videoGameAnimation,
  multiplayer: multiplayerAnimation,
  gaming_player: gamingPlayerAnimation,
  gaming_wheel: gamingWheelAnimation,
  console: consoleAnimation,
  virtual_reality: virtualRealityAnimation,
  headphone: headphoneAnimation,
  
  // Awards
  trophy: trophyAnimation,
  trophy2: trophy2Animation,
  medal: medalAnimation,
  medal2: medal2Animation,
  award: awardAnimation,
  badge: badgeAnimation,
  certificate: certificateAnimation,
  certificate2: certificate2Animation,
  
  // Finance
  wallet: walletAnimation,
  money: moneyAnimation,
  growth: growthAnimation,
  planning: planningAnimation,
  savings: savingsAnimation,
  investment: investmentAnimation,
  loan: loanAnimation,
  bitcoin: bitcoinAnimation,
  ethereum: ethereumAnimation,
  
  // Web Design
  target: targetAnimation,
  rocket: rocketAnimation,
  network: networkAnimation,
  ideas: ideasAnimation,
  security: securityAnimation,
  server: serverAnimation,
  indicator: indicatorAnimation,
  application: applicationAnimation,
  
  // Communication
  chat: chatAnimation,
  messaging: messagingAnimation,
  phone: phoneAnimation,
  discussion: discussionAnimation,
  conference: conferenceAnimation,
  online_forum: onlineForumAnimation,
  microphone: microphoneAnimation,
  radio: radioAnimation,
  
  // Shopping
  shopping_bag: shoppingBagAnimation,
  cart: cartAnimation,
  tag: tagAnimation,
  voucher: voucherAnimation,
  box_discount: boxDiscountAnimation,
  bestseller: bestsellerAnimation,
  tickets: ticketsAnimation,
} as const;

export type LottieIconName = keyof typeof iconAnimations;

interface LottieIconProps {
  name: LottieIconName;
  size?: number;
  className?: string;
  loop?: boolean;
  autoplay?: boolean;
  speed?: number;
  // Hover interaction
  playOnHover?: boolean;
}

/**
 * Animated Lottie icon component
 * 
 * Available icons:
 * - Gaming: gamepad, game_shield, video_game, multiplayer
 * - Awards: trophy, medal, medal2, award, badge
 * - Finance: wallet, money, growth, planning, savings
 * - Web Design: target, rocket, network, ideas, security
 * - Communication: chat, messaging
 * - Shopping: shopping_bag, cart
 * 
 * @example
 * // Basic usage
 * <LottieIcon name="gamepad" size={32} />
 * 
 * // Play on hover
 * <LottieIcon name="trophy" size={24} playOnHover />
 * 
 * // Custom speed
 * <LottieIcon name="rocket" size={40} speed={1.5} />
 */
export function LottieIcon({
  name,
  size = 24,
  className,
  loop = true,
  autoplay = true,
  speed = 1,
  playOnHover = false,
}: LottieIconProps) {
  const lottieRef = useRef<LottieRefCurrentProps>(null);
  
  const animationData = iconAnimations[name];
  
  if (!animationData) {
    console.warn(`LottieIcon: Unknown icon name "${name}"`);
    return null;
  }
  
  const handleMouseEnter = () => {
    if (playOnHover && lottieRef.current) {
      lottieRef.current.play();
    }
  };
  
  const handleMouseLeave = () => {
    if (playOnHover && lottieRef.current) {
      lottieRef.current.stop();
    }
  };
  
  return (
    <div 
      className={className}
      style={{ 
        width: size, 
        height: size,
        // Force transparent background
        background: "transparent",
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Lottie
        lottieRef={lottieRef}
        animationData={animationData}
        loop={loop}
        autoplay={playOnHover ? false : autoplay}
        renderer="svg"
        style={{ 
          width: "100%", 
          height: "100%",
          background: "transparent",
        }}
        rendererSettings={{
          preserveAspectRatio: "xMidYMid meet",
          progressiveLoad: true,
        }}
        onComplete={() => {
          if (speed !== 1 && lottieRef.current) {
            lottieRef.current.setSpeed(speed);
          }
        }}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CONVENIENCE EXPORTS — Named icon components for easier imports
// ═══════════════════════════════════════════════════════════════════════════

// Gaming icons
export function LottieGamepadIcon(props: Omit<LottieIconProps, "name">) {
  return <LottieIcon name="gamepad" {...props} />;
}

export function LottieGameShieldIcon(props: Omit<LottieIconProps, "name">) {
  return <LottieIcon name="game_shield" {...props} />;
}

export function LottieVideoGameIcon(props: Omit<LottieIconProps, "name">) {
  return <LottieIcon name="video_game" {...props} />;
}

export function LottieMultiplayerIcon(props: Omit<LottieIconProps, "name">) {
  return <LottieIcon name="multiplayer" {...props} />;
}

export function LottieGamingPlayerIcon(props: Omit<LottieIconProps, "name">) {
  return <LottieIcon name="gaming_player" {...props} />;
}

export function LottieGamingWheelIcon(props: Omit<LottieIconProps, "name">) {
  return <LottieIcon name="gaming_wheel" {...props} />;
}

export function LottieConsoleIcon(props: Omit<LottieIconProps, "name">) {
  return <LottieIcon name="console" {...props} />;
}

export function LottieVirtualRealityIcon(props: Omit<LottieIconProps, "name">) {
  return <LottieIcon name="virtual_reality" {...props} />;
}

export function LottieHeadphoneIcon(props: Omit<LottieIconProps, "name">) {
  return <LottieIcon name="headphone" {...props} />;
}

// Awards icons
export function LottieTrophyIcon(props: Omit<LottieIconProps, "name">) {
  return <LottieIcon name="trophy" {...props} />;
}

export function LottieMedalIcon(props: Omit<LottieIconProps, "name">) {
  return <LottieIcon name="medal" {...props} />;
}

export function LottieMedal2Icon(props: Omit<LottieIconProps, "name">) {
  return <LottieIcon name="medal2" {...props} />;
}

export function LottieAwardIcon(props: Omit<LottieIconProps, "name">) {
  return <LottieIcon name="award" {...props} />;
}

export function LottieBadgeIcon(props: Omit<LottieIconProps, "name">) {
  return <LottieIcon name="badge" {...props} />;
}

export function LottieTrophy2Icon(props: Omit<LottieIconProps, "name">) {
  return <LottieIcon name="trophy2" {...props} />;
}

export function LottieCertificateIcon(props: Omit<LottieIconProps, "name">) {
  return <LottieIcon name="certificate" {...props} />;
}

export function LottieCertificate2Icon(props: Omit<LottieIconProps, "name">) {
  return <LottieIcon name="certificate2" {...props} />;
}

// Finance icons
export function LottieWalletIcon(props: Omit<LottieIconProps, "name">) {
  return <LottieIcon name="wallet" {...props} />;
}

export function LottieMoneyIcon(props: Omit<LottieIconProps, "name">) {
  return <LottieIcon name="money" {...props} />;
}

export function LottieGrowthIcon(props: Omit<LottieIconProps, "name">) {
  return <LottieIcon name="growth" {...props} />;
}

export function LottiePlanningIcon(props: Omit<LottieIconProps, "name">) {
  return <LottieIcon name="planning" {...props} />;
}

export function LottieSavingsIcon(props: Omit<LottieIconProps, "name">) {
  return <LottieIcon name="savings" {...props} />;
}

export function LottieInvestmentIcon(props: Omit<LottieIconProps, "name">) {
  return <LottieIcon name="investment" {...props} />;
}

export function LottieLoanIcon(props: Omit<LottieIconProps, "name">) {
  return <LottieIcon name="loan" {...props} />;
}

export function LottieBitcoinIcon(props: Omit<LottieIconProps, "name">) {
  return <LottieIcon name="bitcoin" {...props} />;
}

export function LottieEthereumIcon(props: Omit<LottieIconProps, "name">) {
  return <LottieIcon name="ethereum" {...props} />;
}

// Web Design icons
export function LottieTargetIcon(props: Omit<LottieIconProps, "name">) {
  return <LottieIcon name="target" {...props} />;
}

export function LottieRocketIcon(props: Omit<LottieIconProps, "name">) {
  return <LottieIcon name="rocket" {...props} />;
}

export function LottieNetworkIcon(props: Omit<LottieIconProps, "name">) {
  return <LottieIcon name="network" {...props} />;
}

export function LottieIdeasIcon(props: Omit<LottieIconProps, "name">) {
  return <LottieIcon name="ideas" {...props} />;
}

export function LottieSecurityIcon(props: Omit<LottieIconProps, "name">) {
  return <LottieIcon name="security" {...props} />;
}

export function LottieServerIcon(props: Omit<LottieIconProps, "name">) {
  return <LottieIcon name="server" {...props} />;
}

export function LottieIndicatorIcon(props: Omit<LottieIconProps, "name">) {
  return <LottieIcon name="indicator" {...props} />;
}

export function LottieApplicationIcon(props: Omit<LottieIconProps, "name">) {
  return <LottieIcon name="application" {...props} />;
}

// Communication icons
export function LottieChatIcon(props: Omit<LottieIconProps, "name">) {
  return <LottieIcon name="chat" {...props} />;
}

export function LottieMessagingIcon(props: Omit<LottieIconProps, "name">) {
  return <LottieIcon name="messaging" {...props} />;
}

export function LottiePhoneIcon(props: Omit<LottieIconProps, "name">) {
  return <LottieIcon name="phone" {...props} />;
}

export function LottieDiscussionIcon(props: Omit<LottieIconProps, "name">) {
  return <LottieIcon name="discussion" {...props} />;
}

export function LottieConferenceIcon(props: Omit<LottieIconProps, "name">) {
  return <LottieIcon name="conference" {...props} />;
}

export function LottieOnlineForumIcon(props: Omit<LottieIconProps, "name">) {
  return <LottieIcon name="online_forum" {...props} />;
}

export function LottieMicrophoneIcon(props: Omit<LottieIconProps, "name">) {
  return <LottieIcon name="microphone" {...props} />;
}

export function LottieRadioIcon(props: Omit<LottieIconProps, "name">) {
  return <LottieIcon name="radio" {...props} />;
}

// Shopping icons
export function LottieShoppingBagIcon(props: Omit<LottieIconProps, "name">) {
  return <LottieIcon name="shopping_bag" {...props} />;
}

export function LottieCartIcon(props: Omit<LottieIconProps, "name">) {
  return <LottieIcon name="cart" {...props} />;
}

export function LottieTagIcon(props: Omit<LottieIconProps, "name">) {
  return <LottieIcon name="tag" {...props} />;
}

export function LottieVoucherIcon(props: Omit<LottieIconProps, "name">) {
  return <LottieIcon name="voucher" {...props} />;
}

export function LottieBoxDiscountIcon(props: Omit<LottieIconProps, "name">) {
  return <LottieIcon name="box_discount" {...props} />;
}

export function LottieBestsellerIcon(props: Omit<LottieIconProps, "name">) {
  return <LottieIcon name="bestseller" {...props} />;
}

export function LottieTicketsIcon(props: Omit<LottieIconProps, "name">) {
  return <LottieIcon name="tickets" {...props} />;
}
