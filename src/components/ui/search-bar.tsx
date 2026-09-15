import { Pressable, TextInput, View } from "react-native";

import { Search, X } from "@/lib/icons";

export function SearchBar({
  value,
  onChangeText,
  placeholder = "Search",
}: {
  value: string;
  onChangeText: (next: string) => void;
  placeholder?: string;
}) {
  return (
    <View className="h-11 flex-row items-center gap-2 rounded-lg border border-border bg-card px-3">
      <Search size={17} color="#71717A" strokeWidth={2} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#A1A1AA"
        selectionColor="#FF8900"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        className="flex-1 font-sans text-[15px] text-foreground"
        style={{ paddingVertical: 0 }}
      />
      {value.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          onPress={() => onChangeText("")}
          hitSlop={10}
          className="active:opacity-60"
        >
          <X size={16} color="#71717A" strokeWidth={2.2} />
        </Pressable>
      ) : null}
    </View>
  );
}
