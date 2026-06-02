import axios from 'axios';
import type {
  ApiResponse,
  ClusterConfig,
  Overview,
  BrokerInfo,
  TopicInfo,
  TopicDetail,
  TopicConfigEntry,
  ConsumerGroupInfo,
  ConsumerGroupDetail,
  MessageRecord,
  ProduceMessageRequest,
  ProduceMessageResult,
} from '../types';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

function unwrap<T>(response: { data: ApiResponse<T> }): T {
  const { data } = response;
  if (!data.success) {
    throw new Error(data.error || 'Unknown error');
  }
  return data.data as T;
}

// Cluster APIs
export async function listClusters(): Promise<ClusterConfig[]> {
  return unwrap<ClusterConfig[]>(await api.get('/clusters'));
}

export async function addCluster(name: string, brokers: string): Promise<ClusterConfig> {
  return unwrap<ClusterConfig>(await api.post('/clusters', { name, brokers }));
}

export async function updateCluster(id: string, name: string, brokers: string): Promise<ClusterConfig> {
  return unwrap<ClusterConfig>(await api.put(`/clusters/${id}`, { name, brokers }));
}

export async function removeCluster(id: string): Promise<void> {
  unwrap(await api.delete(`/clusters/${id}`));
}

export async function getClusterOverview(id: string): Promise<Overview> {
  return unwrap<Overview>(await api.get(`/clusters/${id}/overview`));
}

export async function listBrokers(clusterId: string): Promise<BrokerInfo[]> {
  return unwrap<BrokerInfo[]>(await api.get(`/clusters/${clusterId}/brokers`));
}

// Topic APIs
export async function listTopics(clusterId: string): Promise<TopicInfo[]> {
  return unwrap<TopicInfo[]>(await api.get(`/clusters/${clusterId}/topics`));
}

export async function getTopicDetail(clusterId: string, topic: string): Promise<TopicDetail> {
  return unwrap<TopicDetail>(await api.get(`/clusters/${clusterId}/topics/${topic}`));
}

export async function createTopic(
  clusterId: string,
  name: string,
  partitionCount: number,
  replicationFactor: number,
): Promise<void> {
  unwrap(await api.post(`/clusters/${clusterId}/topics`, { name, partitionCount, replicationFactor }));
}

export async function deleteTopic(clusterId: string, topic: string): Promise<void> {
  unwrap(await api.delete(`/clusters/${clusterId}/topics/${topic}`));
}

export async function getTopicConfigs(clusterId: string, topic: string): Promise<TopicConfigEntry[]> {
  return unwrap<TopicConfigEntry[]>(
    await api.get(`/clusters/${clusterId}/topics/${encodeURIComponent(topic)}/configs`),
  );
}

export async function updateTopicConfigs(
  clusterId: string,
  topic: string,
  configs: Record<string, string>,
): Promise<void> {
  unwrap(await api.put(`/clusters/${clusterId}/topics/${encodeURIComponent(topic)}/configs`, { configs }));
}

export async function increaseTopicPartitions(
  clusterId: string,
  topic: string,
  totalPartitions: number,
): Promise<void> {
  unwrap(
    await api.post(`/clusters/${clusterId}/topics/${encodeURIComponent(topic)}/partitions`, {
      totalPartitions,
    }),
  );
}

// Consumer Group APIs
export async function listConsumerGroups(clusterId: string): Promise<ConsumerGroupInfo[]> {
  return unwrap<ConsumerGroupInfo[]>(await api.get(`/clusters/${clusterId}/consumer-groups`));
}

export async function getConsumerGroupDetail(clusterId: string, group: string): Promise<ConsumerGroupDetail> {
  return unwrap<ConsumerGroupDetail>(await api.get(`/clusters/${clusterId}/consumer-groups/${group}`));
}

export async function deleteConsumerGroupOffsets(clusterId: string, group: string): Promise<void> {
  unwrap(await api.delete(`/clusters/${clusterId}/consumer-groups/${group}`));
}

// Message APIs
export async function produceMessage(
  clusterId: string,
  topic: string,
  body: ProduceMessageRequest,
): Promise<ProduceMessageResult> {
  return unwrap<ProduceMessageResult>(
    await api.post(`/clusters/${clusterId}/topics/${encodeURIComponent(topic)}/messages`, body),
  );
}

export async function readMessages(
  clusterId: string,
  topic: string,
  params?: {
    partition?: number;
    startOffset?: number;
    limit?: number;
    valueFilter?: string;
  },
): Promise<MessageRecord[]> {
  const data = unwrap<MessageRecord[] | null>(
    await api.get(`/clusters/${clusterId}/topics/${encodeURIComponent(topic)}/messages`, { params }),
  );
  return Array.isArray(data) ? data : [];
}
