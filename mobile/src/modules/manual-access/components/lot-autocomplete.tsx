import { Pressable, Text, View } from 'react-native';

import { Input } from '@/common/components/input';
import { Spinner } from '@/common/components/spinner';
import { useLotSearch } from '@/modules/manual-access/hooks';
import type { LotSuggestion } from '@/modules/manual-access/types';

type LotAutocompleteProps = {
  value: string;
  selectedId: string | null;
  onChange: (code: string) => void;
  onSelect: (lot: LotSuggestion) => void;
  editable: boolean;
};

// Autocomplete de lotes. El input libera lotId cada vez que el usuario
// vuelve a tipear: si edita despues de elegir, hay que volver a elegir
// del listado. Sin lotId el submit falla en validateManualAccess.
export function LotAutocomplete({
  value,
  selectedId,
  onChange,
  onSelect,
  editable,
}: LotAutocompleteProps) {
  const search = useLotSearch(value);

  const showList = !selectedId && value.trim().length > 0;

  return (
    <View className="gap-2">
      <Input
        label="Lote"
        value={value}
        onChangeText={onChange}
        placeholder="M4-L12"
        autoCapitalize="characters"
        editable={editable}
      />
      {showList ? (
        <View className="max-h-56 rounded-lg border border-border bg-bg-surface">
          {search.isFetching ? (
            <View className="items-center py-3">
              <Spinner />
            </View>
          ) : search.isError ? (
            <Text className="px-4 py-3 text-body text-deny">
              No se pudo buscar. Reintentá en unos segundos.
            </Text>
          ) : (search.data ?? []).length === 0 ? (
            <Text className="px-4 py-3 text-body text-text-muted">
              Sin coincidencias.
            </Text>
          ) : (
            (search.data ?? []).map((lot) => (
              <Pressable
                key={lot.id ?? lot.code ?? ''}
                accessibilityRole="button"
                accessibilityLabel={`Elegir lote ${lot.code}`}
                onPress={() => onSelect(lot)}
                className="min-h-12 justify-center border-b border-border px-4 active:opacity-60"
              >
                <Text className="text-body text-text-primary">{lot.code ?? '(sin codigo)'}</Text>
              </Pressable>
            ))
          )}
        </View>
      ) : null}
    </View>
  );
}
