import { View } from 'react-native';
import { FisherList } from '../../components/FisherList';
import type { FisherAdmin } from '../../types';
import { Muted, Screen, Title } from '../../ui';

export function FishersScreen({
  fishers,
  loadError,
  refresh,
  onOpen,
  onAdd,
}: {
  fishers: FisherAdmin[] | null;
  loadError: string | null;
  refresh: () => Promise<FisherAdmin[] | null>;
  onOpen: (fisher: FisherAdmin) => void;
  onAdd: () => void;
}) {
  return (
    <Screen>
      <Title>Fishers</Title>
      {fishers ? <Muted>{`${fishers.length} registered`}</Muted> : null}
      <View>
        <FisherList fishers={fishers} loadError={loadError} onRetry={() => void refresh()} onOpen={onOpen} onAdd={onAdd} />
      </View>
    </Screen>
  );
}
