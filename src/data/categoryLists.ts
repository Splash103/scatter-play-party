export type CategoryList = {
  id: string;
  name: string;
  categories: string[];
};

// A curated set of premade category lists. Each list contains 12 categories.
// Keep names short and fun for easy reference in the UI.
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
];
