import Link from 'next/link';
import { Bike as BikeIcon, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import type { Bike } from '@/types';

interface BikeCardProps {
  bike: Bike;
}

export function BikeCard({ bike }: BikeCardProps) {
  const displayName = [bike.brand, bike.model].filter(Boolean).join(' ') || 'Ukendt cykel';

  return (
    <Link href={`/garage/${bike.id}`}>
      <Card className="flex items-center gap-4 active:scale-[0.98] transition-transform">
        {/* Bike image / placeholder */}
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gray-100 overflow-hidden">
          {bike.primary_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={bike.primary_image_url}
              alt={displayName}
              className="h-full w-full object-cover"
            />
          ) : (
            <BikeIcon className="h-7 w-7 text-gray-400" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 truncate">{displayName}</p>
          <p className="text-sm text-gray-500">
            {[bike.year, bike.type].filter(Boolean).join(' · ') || 'Ingen detaljer'}
          </p>
          {bike.frame_number && (
            <p className="text-xs text-gray-400 truncate">Stel: {bike.frame_number}</p>
          )}
        </div>

        <ChevronRight className="h-5 w-5 shrink-0 text-gray-400" />
      </Card>
    </Link>
  );
}
