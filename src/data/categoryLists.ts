export type CategoryList = {
  id: string;
  name: string;
  categories: string[];
};

// Core curated lists (12 categories each)
export const CATEGORY_LISTS: CategoryList[] = [
  {
    id: "classic-1",
    name: "Classic A",
    categories: [
      "Fruits",
      "Countries",
      "Things in a bedroom",
      "TV Shows",
      "Things that are cold",
      "Animals",
      "Occupations",
      "Colors",
      "Sports",
      "Things you wear",
      "In the kitchen",
      "City names",
    ],
  },
  {
    id: "classic-2",
    name: "Classic B",
    categories: [
      "Vegetables",
      "Capital cities",
      "Things at the beach",
      "Board games",
      "Things that fly",
      "Musical instruments",
      "School subjects",
      "Car brands",
      "Hobbies",
      "Book titles",
      "In the bathroom",
      "Mountains",
    ],
  },
  {
    id: "party-1",
    name: "Party Mix",
    categories: [
      "Pizza toppings",
      "Song titles",
      "Movie characters",
      "Apps on your phone",
      "Snack foods",
      "Things you recycle",
      "Superheroes",
      "Video games",
      "Ice cream flavors",
      "Holidays",
      "Household chores",
      "Parks & landmarks",
    ],
  },
  {
    id: "everyday-1",
    name: "Everyday",
    categories: [
      "Things in a wallet",
      "Items in a backpack",
      "Kitchen appliances",
      "Types of shoes",
      "Drinks",
      "Furniture",
      "Animals at the zoo",
      "Tools",
      "Weather words",
      "Jobs",
      "Transportation",
      "Games",
    ],
  },
  {
    id: "travel-1",
    name: "Travel",
    categories: [
      "Airlines",
      "Hotel amenities",
      "Tourist attractions",
      "Street foods",
      "Currencies",
      "Islands",
      "Rivers",
      "National parks",
      "Languages",
      "Festivals",
      "Famous bridges",
      "Museums",
    ],
  },
  {
    id: "nature-1",
    name: "Nature",
    categories: [
      "Trees",
      "Flowers",
      "Birds",
      "Sea creatures",
      "Deserts",
      "Weather types",
      "Gemstones",
      "Herbs & spices",
      "Insects",
      "Mammals",
      "Planet features",
      "Natural disasters",
    ],
  },
  {
    id: "pop-1",
    name: "Pop Culture",
    categories: [
      "TV channels",
      "Streaming shows",
      "Celebrities",
      "Cartoon characters",
      "Podcasts",
      "Music genres",
      "Album names",
      "YouTubers",
      "Sports teams",
      "Magazines",
      "Comedians",
      "Award shows",
    ],
  },
  {
    id: "food-1",
    name: "Foodies",
    categories: [
      "Breakfast foods",
      "Spices & seasonings",
      "Pasta shapes",
      "Sauces",
      "Cheeses",
      "Baked goods",
      "Fruits",
      "Vegetables",
      "Cooking methods",
      "Desserts",
      "Sandwiches",
      "Seafood dishes",
    ],
  },
  {
    id: "school-1",
    name: "School Life",
    categories: [
      "Classroom items",
      "School clubs",
      "Homework excuses",
      "Teachers' names",
      "Field trip spots",
      "Sports at school",
      "Science terms",
      "Math terms",
      "History topics",
      "Languages",
      "Library books",
      "School events",
    ],
  },
  {
    id: "home-1",
    name: "At Home",
    categories: [
      "Kitchen utensils",
      "Living room items",
      "Bathroom items",
      "Bedroom items",
      "Cleaning supplies",
      "Garden tools",
      "Appliances",
      "Wall decor",
      "Pet supplies",
      "DIY tools",
      "Outdoor furniture",
      "Smart home devices",
    ],
  },
];

// A larger pool for generating randomized lists
export const CATEGORY_POOL: string[] = Array.from(
  new Set(
    CATEGORY_LISTS.flatMap((l) => l.categories).concat([
      "Boarding passes",
      "Camping gear",
      "Programming languages",
      "Websites",
      "Nuts & seeds",
      "Sodas",
      "Street names",
      "Furniture brands",
      "Phone manufacturers",
      "Dog breeds",
      "Cat breeds",
      "Car models",
      "Movie genres",
      "Tea types",
      "Countries in Europe",
      "Rappers",
      "Rock bands",
      "Classical composers",
      "Mobile games",
      "Card games",
      "Picture books",
      "Board game pieces",
      "Bird species",
      "Hiking trails",
      "Beverages",
      "Occupations",
      "Social networks",
      "Kitchen gadgets",
      "Programming tools",
    ])
  )
);

export function generateRandomList(count = 12): CategoryList {
  const pool = [...CATEGORY_POOL];
  const picks: string[] = [];
  for (let i = 0; i < Math.min(count, pool.length); i++) {
    const idx = Math.floor(Math.random() * pool.length);
    picks.push(pool.splice(idx, 1)[0]);
  }
  return {
    id: `rand-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: "Random Mix",
    categories: picks,
  };
}
