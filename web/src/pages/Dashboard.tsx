import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Col, Row, Statistic, Spin, Alert } from 'antd';
import {
  CloudServerOutlined,
  UnorderedListOutlined,
  PartitionOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { useCluster } from '../components/Layout';
import { getClusterOverview } from '../api/client';
import type { Overview } from '../types';

const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const { selectedCluster } = useCluster();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!selectedCluster) return;
    setLoading(true);
    setError('');
    getClusterOverview(selectedCluster.id)
      .then(setOverview)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [selectedCluster]);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '60px auto' }} />;
  if (error) return <Alert type="error" message={t('dashboard.loadFailed')} description={error} />;

  const cards = [
    { title: t('dashboard.brokers'), value: overview?.brokerCount ?? 0, icon: <CloudServerOutlined />, color: '#1677ff' },
    { title: t('dashboard.topics'), value: overview?.topicCount ?? 0, icon: <UnorderedListOutlined />, color: '#52c41a' },
    { title: t('dashboard.partitions'), value: overview?.partitionCount ?? 0, icon: <PartitionOutlined />, color: '#faad14' },
    { title: t('dashboard.consumerGroups'), value: overview?.consumerGroupCount ?? 0, icon: <TeamOutlined />, color: '#722ed1' },
  ];

  return (
    <div>
      <h2>{t('dashboard.title')}</h2>
      <Row gutter={[16, 16]}>
        {cards.map((c) => (
          <Col xs={24} sm={12} lg={6} key={c.title}>
            <Card>
              <Statistic
                title={c.title}
                value={c.value}
                prefix={React.cloneElement(c.icon, { style: { color: c.color } })}
              />
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
};

export default Dashboard;
