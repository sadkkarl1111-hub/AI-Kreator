import { Router } from "express";
import { getBadgePublicUrl } from "../lib/badgeFiles.js";
import {
  listLocalAdminBadges,
  listLocalAdminEmojis,
  listLocalBadgePackageAccess,
  listLocalEmojiCategories,
  listLocalFavoriteEmojis,
  listLocalHiddenStaticBadges,
  setLocalFavoriteEmoji,
} from "../lib/localAdminAssetsData.js";
import { listLocalCreditPackages, listLocalCreditPurchases } from "../lib/localBillingData.js";
import { requireAuthenticatedUser } from "../middleware/requireAuthenticatedUser.js";

export const assetsRouter = Router();

type EmojiCategory = {
  id: string;
  label: string;
  sort_order: number;
};

type AdminEmoji = {
  id: string;
  category_id: string;
  emoji: string;
  sort_order: number;
};

type AdminBadge = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  storage_path: string;
  sort_order: number;
};

type BadgePackageAccess = {
  badge_key: string;
  package_id: string;
};

type CreditPackage = {
  id: string;
  label: string;
  credits: number;
  price_grosze: number;
  active: boolean;
};

type CreditPurchase = {
  amount: number;
  credits: number;
};

assetsRouter.get("/assets/emojis/library", requireAuthenticatedUser, async (request, response) => {
  try {
    const userId = request.authUser!.id;

    const [favoriteRows, categoryRows, emojiRows] = await Promise.all([
      listLocalFavoriteEmojis(userId),
      listLocalEmojiCategories(),
      listLocalAdminEmojis(),
    ]);

    const categories = (categoryRows as EmojiCategory[])
      .map((category) => ({
        label: category.label,
        emojis: (emojiRows as AdminEmoji[])
          .filter((emoji) => emoji.category_id === category.id)
          .map((emoji) => emoji.emoji),
      }))
      .filter((category) => category.emojis.length > 0);

    response.json({
      ok: true,
      favorites: favoriteRows.map((row: { emoji: string }) => row.emoji),
      adminCategories: categories,
    });
  } catch (error) {
    console.error("VPS emoji library error:", error);
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Nie udalo sie pobrac emoji.",
    });
  }
});

assetsRouter.get("/assets/badges/library", (request, response, next) => {
  // Guests need the same visibility and package restrictions as signed-in users.
  if (request.header("authorization")) {
    return requireAuthenticatedUser(request, response, next);
  }
  next();
}, async (request, response) => {
  try {
    response.setHeader("Cache-Control", "no-store");
    const userId = request.authUser?.id;

    const [
      hiddenRows,
      badgeRows,
      accessRows,
      packageRows,
      purchaseRows,
      allPackageRows,
    ] = await Promise.all([
      listLocalHiddenStaticBadges(),
      listLocalAdminBadges(),
      listLocalBadgePackageAccess(),
      listLocalCreditPackages({ activeOnly: true }),
      userId ? listLocalCreditPurchases({ userId, status: "completed" }) : Promise.resolve([]),
      listLocalCreditPackages(),
    ]);

    const packages = packageRows as CreditPackage[];
    const allPackages = allPackageRows as CreditPackage[];
    const purchases = purchaseRows as CreditPurchase[];
    const purchasedPackageIds = new Set<string>();

    for (const purchase of purchases) {
      for (const creditPackage of allPackages) {
        if (purchase.credits === creditPackage.credits && purchase.amount === creditPackage.price_grosze) {
          purchasedPackageIds.add(creditPackage.id);
        }
      }
    }

    response.json({
      ok: true,
      hiddenKeys: hiddenRows.map((row: { badge_key: string }) => row.badge_key),
      badges: await Promise.all(
        (badgeRows as AdminBadge[]).map(async (badge) => ({
          id: badge.id,
          name: badge.name,
          description: badge.description || "",
          category: badge.category,
          src: await getBadgePublicUrl(badge.storage_path),
        }))
      ),
      access: accessRows as BadgePackageAccess[],
      packages: packages.map((creditPackage) => ({
        id: creditPackage.id,
        label: creditPackage.label,
      })),
      purchasedPackageIds: Array.from(purchasedPackageIds),
    });
  } catch (error) {
    console.error("VPS badge library error:", error);
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Nie udalo sie pobrac badge'y.",
    });
  }
});

assetsRouter.post("/assets/emojis/favorites/toggle", requireAuthenticatedUser, async (request, response) => {
  try {
    const userId = request.authUser!.id;
    const { emoji, favorite } = request.body as { emoji?: string; favorite?: boolean };

    if (!emoji) {
      response.status(400).json({ ok: false, error: "Emoji jest wymagane" });
      return;
    }

    const isFavorite = Boolean(favorite);
    await setLocalFavoriteEmoji(userId, emoji, isFavorite);
    response.json({ ok: true, favorite: isFavorite });
  } catch (error) {
    console.error("VPS emoji favorite toggle error:", error);
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Nie udalo sie zapisac ulubionych emoji.",
    });
  }
});
