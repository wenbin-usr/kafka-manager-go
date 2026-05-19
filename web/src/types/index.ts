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

export interface TopicConfigEntry {
  name: string;
  value: string;
  defaultValue?: string;
  readOnly: boolean;
  sensitive: boolean;
  documentation?: string;
  editable: boolean;
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

export interface MessageHeader {
  key: string;
  value: string;
  encoding?: 'utf8' | 'base64';
}

export interface ProduceMessageHeader {
  key: string;
  value: string;
}

export interface ProduceMessageRequest {
  key?: string;
  value: string;
  partition?: number;
  headers?: ProduceMessageHeader[];
}

export interface ProduceMessageResult {
  partition: number;
  offset: number;
}

export interface MessageRecord {
  partition: number;
  offset: number;
  key: string;
  value: string;
  timestamp: string;
  isJson: boolean;
  headers?: MessageHeader[];
}

export interface Overview {
  brokerCount: number;
  topicCount: number;
  partitionCount: number;
  consumerGroupCount: number;
}

export interface BrokerTopicAssignment {
  topic: string;
  partition: number;
  role: 'leader' | 'replica' | string;
}

export interface BrokerInfo {
  id: number;
  host: string;
  port: number;
  address: string;
  rack?: string;
  isController: boolean;
  clusterId?: string;
  leaderPartitions: number;
  replicaPartitions: number;
  assignments: BrokerTopicAssignment[];
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
