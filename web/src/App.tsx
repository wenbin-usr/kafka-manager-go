import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Brokers from './pages/Brokers';
import Topics from './pages/Topics';
import TopicDetail from './pages/TopicDetail';
import ConsumerGroups from './pages/ConsumerGroups';
import ConsumerGroupDetail from './pages/ConsumerGroupDetail';
import MessageViewer from './pages/MessageViewer';

const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="brokers" element={<Brokers />} />
        <Route path="topics" element={<Topics />} />
        <Route path="topics/:topic" element={<TopicDetail />} />
        <Route path="consumer-groups" element={<ConsumerGroups />} />
        <Route path="consumer-groups/:group" element={<ConsumerGroupDetail />} />
        <Route path="messages" element={<MessageViewer />} />
      </Route>
    </Routes>
  );
};

export default App;
