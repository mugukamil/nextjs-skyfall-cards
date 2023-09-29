import { AnimatedCardWithQuantity, Pagination, Search } from "@/app/components.client";
import { eq, like, notLike, and } from "drizzle-orm";
import { cardsTable, collectionTable, db } from "@/database";
import { revalidatePath } from "next/cache";

async function addCardToCollection(id: string) {
    "use server";

    db.insert(collectionTable)
        .values({ id, quantity: 0 })
        .onConflictDoNothing({ target: collectionTable.id })
        .run();
    const currentQuantity = db
        .select({ quantity: collectionTable.quantity })
        .from(collectionTable)
        .where(eq(collectionTable.id, id))
        .all();
    db.update(collectionTable)
        .set({ quantity: currentQuantity[0].quantity + 1 })
        .where(eq(collectionTable.id, id))
        .run();

    revalidatePath("/");
}

async function removeCardFromCollection(id: string) {
    "use server";

    const currentQuantity = db
        .select({ quantity: collectionTable.quantity })
        .from(collectionTable)
        .where(eq(collectionTable.id, id))
        .all();
    if (currentQuantity[0]?.quantity === undefined || currentQuantity[0].quantity === 0) return;
    db.update(collectionTable)
        .set({ quantity: currentQuantity[0].quantity - 1 })
        .where(eq(collectionTable.id, id))
        .run();

    revalidatePath("/");
}
async function CardCount() {
    const response = await fetch("https://api.scryfall.com/sets");
    const body = await response.json();

    const totalCards = body.data.reduce((acc, set) => acc + set.card_count, 0);
    return <div>{totalCards.toLocaleString()} cards in total</div>;
}

export default async function Home({
    searchParams,
}: {
    searchParams: { name?: string; page?: string };
}) {
    const PAGE_SIZE = 20;

    const cards = db
        .select({
            id: cardsTable.id,
            name: cardsTable.name,
            imageUri: cardsTable.imageUri,
            quantity: collectionTable.quantity,
        })
        .from(cardsTable)
        .leftJoin(collectionTable, eq(cardsTable.id, collectionTable.id))
        .where(
            and(
                like(cardsTable.name, `%${searchParams.name ?? ""}%`),
                notLike(cardsTable.name, "%god%"),
            ),
        )
        .offset((Number(searchParams.page) - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .all();

    const totalCards = db
        .select({ id: cardsTable.id })
        .from(cardsTable)
        .where(
            and(like(cardsTable.name, `%${searchParams.name}%`), notLike(cardsTable.name, "%god%")),
        )
        .all();

    const totalPages = Math.ceil(totalCards.length / PAGE_SIZE);

    const isLastPage = Number(searchParams.page) === totalPages;
    const hasNextPage = !isLastPage && totalPages > 0;
    return (
        <main className="min-h-screen p-8 flex flex-col gap-y-8">
            <CardCount />
            <Search />
            <p>{searchParams.name && totalCards.length} Cards found</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 justify-items-center ">
                {cards.map((card) => (
                    <AnimatedCardWithQuantity
                        key={card.id}
                        {...card}
                        quantity={card.quantity ?? 0}
                        onClickPlus={addCardToCollection}
                        onClickMinus={removeCardFromCollection}
                    />
                ))}
            </div>
            <Pagination hasNextPage={hasNextPage} />
        </main>
    );
}
