export class ResourceUsageSeriesPointDto {
	timestamp: string;
	cpuTimeSeconds: number;
	cpuPercent: number;
	walltimeSeconds: number;
	ramBytesAllocated: number;
	ramBytesUsed: number;
}

export class ResourceUsageTotalsDto {
	totalVcpus: number;
	storageBytesAllocated: number;
	lastUpdated: string;
}

export class ResourceUsageScopeOptionDto {
	id: string;
	type: 'user' | 'project' | 'allocation';
	label: string;
	source?: string;
}

export class ResourceUsageAllocationOptionDto {
	id: string;
	label: string;
	source: string;
}

export class ResourceUsageSummaryResponseDto {
	scope: ResourceUsageScopeOptionDto;
	availableScopes: ResourceUsageScopeOptionDto[];
	availableSources: string[];
	availableAllocations: ResourceUsageAllocationOptionDto[];
	totals: ResourceUsageTotalsDto;
	series: ResourceUsageSeriesPointDto[];
}
