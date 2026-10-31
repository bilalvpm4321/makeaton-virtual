import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** GET search form. Keeps the URL shareable; the page reads `q` from searchParams. */
export function SearchForm({ placeholder, defaultValue }: { placeholder: string; defaultValue?: string }) {
  return (
    <form method="get" role="search" className="flex w-full max-w-md items-center gap-2">
      <Input type="search" name="q" placeholder={placeholder} aria-label={placeholder} defaultValue={defaultValue} />
      <Button type="submit" variant="outline">
        <Search />
        Search
      </Button>
    </form>
  );
}
