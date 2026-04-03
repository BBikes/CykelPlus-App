import Link from 'next/link';
import { Bike as BikeIcon, ChevronRight, MapPin } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Bike } from '@/types';

interface BikeCardProps {
  bike: Bike;
}

export function BikeCard({ bike }: BikeCardProps) {
  const displayName = [bike.brand, bike.model].filter(Boolean).join(' ') || 'Ukendt cykel';
  const bikeMeta = [bike.type, bike.color].filter(Boolean).join(' - ') || 'Klar til service';

  return (
    <Link href={`/garage/${bike.id}`}>
      <Card className="flex items-center gap-4 rounded-[24px] px-4 py-4 transition-transform active:scale-[0.99]">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[20px] bg-blue-50">
          {bike.primary_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={bike.primary_image_url}
              alt={displayName}
              className="h-full w-full object-cover"
            />
          ) : (
            <BikeIcon className="h-7 w-7 text-blue-600" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-[1.05rem] font-semibold leading-6 text-slate-900">
              {displayName}
            </p>
            {bike.tracker_active && <Badge variant="blue">Tracker</Badge>}
          </div>
          <p className="mt-1 truncate text-sm text-slate-500">{bikeMeta}</p>
          <div className="mt-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.1em] text-slate-400">
            {bike.frame_number ? <span className="truncate">Stel {bike.frame_number}</span> : <span>BikeDesk synkroniseret</span>}
            {bike.tracker_status && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[0.65rem] font-semibold text-slate-500">
                <MapPin className="h-3 w-3" />
                {bike.tracker_status === 'active'
                  ? 'Aktiv'
                  : bike.tracker_status === 'low_battery'
                    ? 'Lavt batteri'
                    : 'Offline'}
              </span>
            )}
          </div>
        </div>

        <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" />
      </Card>
    </Link>
  );
}
