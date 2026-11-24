// @house/ui — shared component library. Import styles once per app: `import '@house/ui/styles.css'`.
export { cx, type ClassValue } from './lib/cx';
export { BREAKPOINTS, MEDIA } from './lib/breakpoints';
export { DEAL_KIND_LABEL, dealKindOf, type DealKind, type LinkAs } from './lib/types';
export {
  useControllable,
  useDismiss,
  useFocusTrap,
  useScrollLock,
  useMounted,
  useAnchoredPosition,
  useDebouncedValue,
  type Placement,
} from './lib/hooks';
export {
  parseManwonInput,
  formatManwonInput,
  formatManwonReading,
  manwonStepLabel,
} from './lib/money';

// Brand & icons
export { BrandMark } from './brand/BrandMark';
export { Logo, type LogoProps } from './brand/Logo';
export { Icon, ICON_NAMES, type IconName, type IconProps } from './icons/Icon';
export {
  CategoryIcon,
  CategoryTile,
  type CategoryIconName,
  type CategoryIconProps,
  type CategoryTileProps,
} from './icons/CategoryIcon';
export { KakaoMark, NaverMark, GoogleMark } from './icons/BrandMarks';
export { SuncheonMapArt, SUNCHEON_MAP_VIEWBOX } from './art/SuncheonMapArt.generated';

// Actions
export { Button, type ButtonProps, type ButtonSize, type ButtonVariant } from './components/Button';
export { IconButton, type IconButtonProps } from './components/IconButton';
export {
  SocialButton,
  type SocialButtonProps,
  type SocialProvider,
} from './components/SocialButton';
export { Spinner, type SpinnerProps } from './components/Spinner';
export { BackLink, type BackLinkProps } from './components/BackLink';
export { ProviderTile, type ProviderTileProps } from './components/ProviderTile';

// Forms
export { Field, type FieldProps } from './components/Field';
export {
  Input,
  Textarea,
  Select,
  type InputProps,
  type TextareaProps,
  type SelectProps,
  type SelectOption,
} from './components/Input';
export {
  Checkbox,
  Radio,
  RadioGroup,
  Switch,
  type CheckboxProps,
  type RadioProps,
  type RadioGroupProps,
  type SwitchProps,
} from './components/Checkbox';
export {
  Combobox,
  SearchField,
  type ComboboxOption,
  type ComboboxProps,
  type SearchFieldProps,
} from './components/Combobox';
export {
  SegmentedControl,
  type SegmentedControlProps,
  type SegmentOption,
} from './components/SegmentedControl';
export {
  ListSearchField,
  type ListSearchFieldProps,
  type ListSearchMode,
} from './components/ListSearchField';
export {
  MoneyInput,
  manwonHint,
  type MoneyInputProps,
  type MoneyInputNativeProps,
} from './components/MoneyInput';
export { ChoiceChip, type ChoiceChipProps } from './components/ChoiceChip';
export {
  FormSection,
  FormRow,
  FieldError,
  HelpLine,
  type FormSectionProps,
  type FormRowProps,
  type FieldErrorProps,
  type HelpLineProps,
} from './components/FormLayout';
export { RangeSlider, type RangeSliderProps } from './components/RangeSlider';
export { Dropzone, type DropzoneProps } from './components/Dropzone';

// Navigation & filters
export {
  Tabs,
  TabPanel,
  type TabsProps,
  type TabItem,
  type TabPanelProps,
} from './components/Tabs';
export { Chip, FilterChip, type ChipProps, type FilterChipProps } from './components/Chip';
export { FilterDropdown, type FilterDropdownProps } from './components/FilterDropdown';
export { Breadcrumb, type BreadcrumbItem, type BreadcrumbProps } from './components/Breadcrumb';
export { Pagination, paginationRange, type PaginationProps } from './components/Pagination';
export { Stepper, type StepItem, type StepperProps } from './components/Stepper';

// Data display
export {
  Badge,
  DealBadge,
  DealLabel,
  PremiumBadge,
  RankDelta,
  AdBadge,
  VerifiedBadge,
  BrokersBadge,
  StatusPill,
  Tag,
  type BadgeProps,
  type DealBadgeProps,
  type PremiumBadgeProps,
  type RankDeltaProps,
  type StatusPillProps,
  type StatusTone,
  type TagProps,
} from './components/Badge';
export { DealCount, type DealCounts, type DealCountProps } from './components/DealCount';
export { Card, Panel, type CardProps, type PanelProps } from './components/Card';
export { ListingCard, type ListingCardProps } from './components/ListingCard';
export { ComplexRow, type ComplexRowProps } from './components/ComplexRow';
export { BrokerCard, type BrokerCardProps } from './components/BrokerCard';
export { StatTile, Delta, type StatTileProps, type DeltaProps } from './components/StatTile';
export {
  Table,
  type TableProps,
  type TableColumn,
  type TableSort,
  type SortDir,
} from './components/Table';
export { Avatar, AvatarStack, type AvatarProps, type AvatarStackProps } from './components/Avatar';
export {
  AgencyLogo,
  agencyInitials,
  agencyLogoTone,
  type AgencyLogoProps,
  type AgencyLogoTone,
  type AgencyLogoFallback,
} from './components/AgencyLogo';
export {
  PhotoPlaceholder,
  photoKindForAsset,
  PHOTO_KINDS,
  type PhotoKind,
  type PhotoPlaceholderProps,
} from './components/PhotoPlaceholder';
export { AdFrame, type AdFrameProps, type AdFrameSlot } from './components/AdFrame';
export {
  Sparkline,
  LineChart,
  BarChart,
  niceTicks,
  type SparklineProps,
  type LineChartProps,
  type BarChartProps,
  type ChartSeries,
} from './components/Charts';

// Feedback & overlays
export {
  Skeleton,
  SkeletonText,
  ListingCardSkeleton,
  LoadingRegion,
  type SkeletonProps,
} from './components/Skeleton';
export { Callout, type CalloutProps, type CalloutTone } from './components/Callout';
export {
  EmptyState,
  ErrorState,
  type EmptyStateProps,
  type ErrorStateProps,
} from './components/States';
export { Modal, ConfirmDialog, type ModalProps, type ConfirmDialogProps } from './components/Modal';
export {
  Drawer,
  SheetSurface,
  CtaBar,
  type DrawerProps,
  type SheetSurfaceProps,
  type CtaBarProps,
} from './components/Drawer';
export { Popover, type PopoverProps, type PopoverTriggerProps } from './components/Popover';
export { Tooltip, type TooltipProps } from './components/Tooltip';
export { ToastProvider, useToast, type ToastApi, type ToastOptions } from './components/Toast';
