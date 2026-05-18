export interface ClusterConfig {
  id: string;
  name: string;
  brokers: string;
}

export interface TopicInfo {
  name: string;
  partitionCount: number;
  replicationFactor: number;
}

export interface PartitionInfo {
  partition: number;
  leader: number;
  replicas: number[];
  isr: number[];
  firstOffset: number;
  lastOffset: number;
  messageCount: number;
}

export interface TopicDetail {
  name: string;
  partitionCount: number;
  replicationFactor: number;
  partitions: PartitionInfo[];
  totalMessages: number;
}

export interface ConsumerGroupInfo {
  groupId: string;
  state: string;
  members: number;
}

export interface ConsumerMember {
  id: string;
  clientId: string;
  clientHost: string;
  assignments: string;
}

export interface ConsumerOffset {
  topic: string;
  partition: number;
  offset: number;
  logEnd: number;
  lag: number;
}

export interface ConsumerGroupDetail {
  groupId: string;
  state: string;
  members: ConsumerMember[];
  offsets: ConsumerOffset[];
  totalLag: number;
}

export interface MessageRecord {
  partition: number;
  offset: number;
  key: string;
  value: string;
  timestamp: string;
  isJson: boolean;
}

export interface Overview {
  brokerCount: number;
  topicCount: number;
  partitionCount: number;
  consumerGroupCount: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
