import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Table, Input, Button, Space, message, Popconfirm, Tag } from 'antd';
import { ReloadOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useCluster } from '../components/Layout';
import { listConsumerGroups, deleteConsumerGroupOffsets } from '../api/client';
import type { ConsumerGroupInfo } from '../types';

const stateColors: Record<string, string> = {
  Stable: 'green',
  Empty: 'default',
  PreparingRebalance: 'orange',
  CompletingRebalance: 'orange',
  Dead: 'red',
};

const rebalanceTag = (type: string | undefined, t: (key: string) => string) => {
  if (type === 'cooperative') {
    return <Tag color="blue">{t('consumerGroups.rebalanceCooperative')}</Tag>;
  }
  if (type === 'eager') {
    return <Tag color="purple">{t('consumerGroups.rebalanceEager')}</Tag>;
  }
  return <span>{t('consumerGroups.unknownStrategy')}</span>;
};

const ConsumerGroups: React.FC = () => {
  const { t } = useTranslation();
  const { selectedCluster } = useCluster();
  const navigate = useNavigate();
  const [groups, setGroups] = useState<ConsumerGroupInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const fetchGroups = async () => {
    if (!selectedCluster) return;
    setLoading(true);
    try {
      const data = await listConsumerGroups(selectedCluster.id);
      setGroups(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('consumerGroups.loadFailed');
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, [selectedCluster]);

  const handleDeleteOffsets = async (groupId: string) => {
    if (!selectedCluster) return;
    try {
      await deleteConsumerGroupOffsets(selectedCluster.id, groupId);
      message.success(t('consumerGroups.offsetsDeleted'));
      fetchGroups();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('consumerGroups.deleteFailed');
      message.error(msg);
    }
  };

  const filtered = groups.filter((g) => g.groupId.toLowerCase().includes(search.toLowerCase()));

  const columns = [
    {
      title: t('consumerGroups.groupId'),
      dataIndex: 'groupId',
      key: 'groupId',
      render: (groupId: string) => (
        <a onClick={() => navigate(`/consumer-groups/${encodeURIComponent(groupId)}`)}>{groupId}</a>
      ),
    },
    {
      title: t('consumerGroups.state'),
      dataIndex: 'state',
      key: 'state',
      width: 180,
      render: (state: string) => <Tag color={stateColors[state] || 'default'}>{state}</Tag>,
    },
    {
      title: t('consumerGroups.assignmentStrategy'),
      dataIndex: 'assignmentStrategies',
      key: 'assignmentStrategies',
      width: 200,
      render: (strategies: string | undefined) => strategies || t('consumerGroups.unknownStrategy'),
    },
    {
      title: t('consumerGroups.rebalanceType'),
      dataIndex: 'rebalanceType',
      key: 'rebalanceType',
      width: 160,
      render: (type: string | undefined) => rebalanceTag(type, t),
    },
    {
      title: t('consumerGroups.members'),
      dataIndex: 'members',
      key: 'members',
      width: 100,
    },
    {
      title: t('common.action'),
      key: 'action',
      width: 100,
      render: (_: unknown, record: ConsumerGroupInfo) => (
        <Popconfirm
          title={t('consumerGroups.deleteOffsetsConfirm')}
          description={t('consumerGroups.deleteOffsetsDescription', { groupId: record.groupId })}
          onConfirm={() => handleDeleteOffsets(record.groupId)}
        >
          <Button danger size="small" icon={<DeleteOutlined />}>
            {t('common.delete')}
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>{t('consumerGroups.title')}</h2>
        <Space>
          <Input.Search
            placeholder={t('consumerGroups.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 250 }}
            allowClear
          />
          <Button icon={<ReloadOutlined />} onClick={fetchGroups} />
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={filtered}
        rowKey="groupId"
        loading={loading}
        pagination={{ pageSize: 20, showSizeChanger: true }}
      />
    </div>
  );
};

export default ConsumerGroups;
