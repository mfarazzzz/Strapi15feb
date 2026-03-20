/**
 * RBAC Manager HomePage - Strapi v5 Compatible
 * Uses useFetchClient hook for API calls
 */

import React, { useEffect, useState } from 'react';
import { useFetchClient } from '@strapi/strapi/admin';
import { Main } from '@strapi/strapi/admin/ui';
import { Box } from '@strapi/strapi/admin/ui/box';
import { Button } from '@strapi/strapi/admin/ui/button';
import { Flex } from '@strapi/strapi/admin/ui/flex';
import { Typography } from '@strapi/strapi/admin/ui/typography';

interface User {
  id: number;
  username: string;
  email: string;
  role?: {
    id: number;
    name: string;
    type: string;
  };
  createdAt: string;
  isActive?: boolean;
}

interface Role {
  id: number;
  name: string;
  type: string;
  description?: string;
}

const HomePage: React.FC = () => {
  const { get } = useFetchClient();
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch users with roles populated
      const usersRes = await get('/api/users?populate=role&sort=createdAt:desc');
      // Fetch roles from users-permissions
      const rolesRes = await get('/api/users-permissions/roles');

      setUsers(usersRes.data || []);
      setRoles(rolesRes.data || []);
    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRefresh = () => {
    fetchData();
  };

  // Calculate stats
  const totalUsers = users.length;
  const adminUsers = users.filter(u => u.role?.type === 'admin').length;
  const editorUsers = users.filter(u => u.role?.type === 'editor').length;
  const authorUsers = users.filter(u => u.role?.type === 'author').length;

  if (loading) {
    return (
      <Main>
        <Box padding={4}>
          <Typography variant="omega" fontWeight="bold">
            Loading users...
          </Typography>
        </Box>
      </Main>
    );
  }

  if (error) {
    return (
      <Main>
        <Box padding={4}>
          <Typography variant="omega" textColor="danger">
            Error: {error}
          </Typography>
          <Button onClick={handleRefresh} marginTop={2}>
            Retry
          </Button>
        </Box>
      </Main>
    );
  }

  return (
    <Main>
      <Box padding={4}>
        <Flex justifyContent="space-between" alignItems="center" marginBottom={4}>
          <Typography variant="alpha" fontWeight="bold">
            RBAC Users Management
          </Typography>
          <Button onClick={handleRefresh} variant="secondary">
            Refresh
          </Button>
        </Flex>

        {/* Stats Cards */}
        <Box background="neutral0" padding={4} hasRadius shadow="tableShadow" marginBottom={4}>
          <Flex gap={4}>
            <Box 
              flex={1} 
              padding={3} 
              background="primary100" 
              hasRadius
            >
              <Typography variant="delta" fontWeight="bold">
                Total Users
              </Typography>
              <Typography variant="huge" fontWeight="bold" textColor="primary600">
                {totalUsers}
              </Typography>
            </Box>
            <Box 
              flex={1} 
              padding={3} 
              background="success100" 
              hasRadius
            >
              <Typography variant="delta" fontWeight="bold">
                Admins
              </Typography>
              <Typography variant="huge" fontWeight="bold" textColor="success600">
                {adminUsers}
              </Typography>
            </Box>
            <Box 
              flex={1} 
              padding={3} 
              background="warning100" 
              hasRadius
            >
              <Typography variant="delta" fontWeight="bold">
                Editors
              </Typography>
              <Typography variant="huge" fontWeight="bold" textColor="warning600">
                {editorUsers}
              </Typography>
            </Box>
            <Box 
              flex={1} 
              padding={3} 
              background="info100" 
              hasRadius
            >
              <Typography variant="delta" fontWeight="bold">
                Authors
              </Typography>
              <Typography variant="huge" fontWeight="bold" textColor="info600">
                {authorUsers}
              </Typography>
            </Box>
          </Flex>
        </Box>

        {/* Users Table */}
        <Box background="neutral0" padding={4} hasRadius shadow="tableShadow">
          <Typography variant="beta" fontWeight="bold" marginBottom={3}>
            Users List
          </Typography>
          
          {users.length === 0 ? (
            <Typography variant="omega">No users found.</Typography>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e5e5' }}>
                  <th style={{ textAlign: 'left', padding: '12px 8px' }}>ID</th>
                  <th style={{ textAlign: 'left', padding: '12px 8px' }}>Username</th>
                  <th style={{ textAlign: 'left', padding: '12px 8px' }}>Email</th>
                  <th style={{ textAlign: 'left', padding: '12px 8px' }}>Role</th>
                  <th style={{ textAlign: 'left', padding: '12px 8px' }}>Created</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '12px 8px' }}>{user.id}</td>
                    <td style={{ padding: '12px 8px' }}>{user.username}</td>
                    <td style={{ padding: '12px 8px' }}>{user.email}</td>
                    <td style={{ padding: '12px 8px' }}>
                      <span style={{ 
                        padding: '4px 8px', 
                        borderRadius: '4px',
                        background: user.role?.type === 'admin' ? '#d3f9d8' : 
                                   user.role?.type === 'editor' ? '#fff3bf' : '#e7f5ff',
                        color: user.role?.type === 'admin' ? '#2b8a3e' : 
                               user.role?.type === 'editor' ? '#e67700' : '#1971c2',
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}>
                        {user.role?.name || 'No Role'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Box>
      </Box>
    </Main>
  );
};

export default HomePage;
