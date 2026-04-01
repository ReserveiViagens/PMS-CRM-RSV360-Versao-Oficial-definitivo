# 📊 Fase 2: Integração CRM - Novas APIs Implementadas

**Data:** 2 de Abril de 2026  
**Status:** ✅ Concluído  
**Branch:** `upgrade/align-crm-rsv360`

---

## 📋 Resumo das Mudanças

Esta fase implementou três APIs essenciais para o módulo CRM:
1. **API de Campanhas** - Gerenciamento de campanhas de marketing
2. **API de Interações** - Rastreamento de interações com clientes
3. **API de Análise CRM** - Insights e métricas de desempenho

---

## 🎯 Endpoints Implementados

### 1️⃣ Campanhas (`/api/campaigns`)

#### GET `/api/campaigns`
Listar todas as campanhas com paginação e filtros.

**Parâmetros de Query:**
- `page` (int) - Número da página (padrão: 1)
- `limit` (int) - Itens por página, máx 100 (padrão: 10)
- `search` (string) - Buscar por nome ou descrição
- `status` (string) - Filtrar por status: `draft`, `scheduled`, `sent`, `cancelled`
- `type` (string) - Filtrar por tipo

**Resposta:**
```json
{
  "success": true,
  "data": {
    "campaigns": [
      {
        "id": 1,
        "name": "Summer Campaign",
        "type": "email",
        "status": "sent",
        "metrics": { "opens": 150, "clicks": 25 },
        "created_at": "2026-04-01T10:00:00Z"
      }
    ],
    "pagination": {
      "total": 45,
      "count": 10,
      "per_page": 10,
      "current_page": 1,
      "total_pages": 5
    }
  }
}
```

#### GET `/api/campaigns/{id}`
Obter detalhes de uma campanha específica.

#### POST `/api/campaigns`
Criar uma nova campanha.

**Campos Obrigatórios:**
- `name` (string, 1-255 caracteres)
- `type` (string): `email`, `sms`, `push`, `social`
- `content` (object) - Conteúdo da campanha em JSON

**Campos Opcionais:**
- `description` (string)
- `segment_id` (int)
- `scheduled_at` (ISO8601)

#### PUT `/api/campaigns/{id}`
Atualizar uma campanha existente.

#### DELETE `/api/campaigns/{id}`
Deletar uma campanha (apenas admin).

---

### 2️⃣ Interações (`/api/interactions`)

#### GET `/api/interactions`
Listar todas as interações com filtros avançados.

**Parâmetros de Query:**
- `customer_id` (int) - Filtrar por cliente
- `type` (string) - Tipo de interação
- `direction` (string): `inbound` ou `outbound`
- `status` (string): `ongoing`, `completed`, `pending`
- `page` (int) - Paginação
- `limit` (int) - Itens por página

**Resposta:**
```json
{
  "success": true,
  "data": {
    "interactions": [
      {
        "id": 1,
        "customer_id": 5,
        "customer_name": "João Silva",
        "customer_email": "joao@example.com",
        "type": "email",
        "direction": "inbound",
        "subject": "Dúvida sobre reserva",
        "status": "completed",
        "assigned_to": "maria",
        "created_at": "2026-04-01T09:30:00Z"
      }
    ],
    "pagination": { /* ... */ }
  }
}
```

#### GET `/api/interactions/by-customer/{customerId}`
Listar todas as interações de um cliente específico.

**Parâmetros:**
- `limit` (int) - Máximo de registros (padrão: 20)

#### GET `/api/interactions/stats/summary`
Obter estatísticas agregadas de interações.

**Resposta:**
```json
{
  "success": true,
  "data": {
    "by_type": [
      { "type": "email", "count": 245 },
      { "type": "phone", "count": 180 }
    ],
    "by_status": [
      { "status": "completed", "count": 390 },
      { "status": "pending", "count": 35 }
    ],
    "by_direction": [
      { "direction": "inbound", "count": 280 },
      { "direction": "outbound", "count": 145 }
    ],
    "total_interactions": { "count": 425 }
  }
}
```

#### POST `/api/interactions`
Criar uma nova interação.

**Campos Obrigatórios:**
- `customer_id` (int)
- `type` (string)
- `direction` (string): `inbound` ou `outbound`

**Campos Opcionais:**
- `subject` (string)
- `content` (text)
- `assigned_to` (string)
- `status` (string) - Padrão: `ongoing`

#### PUT `/api/interactions/{id}`
Atualizar uma interação.

#### DELETE `/api/interactions/{id}`
Deletar uma interação (apenas admin).

---

### 3️⃣ Análise CRM (`/api/crm-analytics`)

#### GET `/api/crm-analytics/dashboard`
Visão geral do dashboard CRM com KPIs principais.

**Resposta:**
```json
{
  "success": true,
  "data": {
    "timestamp": "2026-04-01T14:30:00Z",
    "customers": {
      "total": 1250,
      "active": 980,
      "new_this_month": 42
    },
    "campaigns": {
      "total": 45,
      "active": 8
    },
    "interactions": {
      "total": 425,
      "pending": 12
    },
    "bookings": {
      "total": 2100,
      "avg_per_customer": 1.68
    }
  }
}
```

#### GET `/api/crm-analytics/customer-segments`
Análise de segmentação de clientes.

**Resposta:**
```json
{
  "success": true,
  "data": {
    "by_type": [
      {
        "type": "individual",
        "count": 950,
        "avg_spent": 1250.50
      },
      {
        "type": "corporate",
        "count": 300,
        "avg_spent": 5600.75
      }
    ],
    "by_status": [
      { "status": "active", "count": 980 },
      { "status": "inactive", "count": 270 }
    ],
    "high_value_customers": [
      {
        "id": 15,
        "name": "Empresa X",
        "email": "contact@empresax.com",
        "total_spent": 125000.00,
        "total_bookings": 45
      }
    ]
  }
}
```

#### GET `/api/crm-analytics/campaign-performance`
Métricas de desempenho das campanhas.

**Resposta:**
```json
{
  "success": true,
  "data": {
    "by_type": [
      {
        "type": "email",
        "total": 30,
        "sent": 28
      }
    ],
    "by_status": [
      { "status": "sent", "count": 28 },
      { "status": "scheduled", "count": 8 }
    ],
    "recent_campaigns": [
      {
        "id": 45,
        "name": "Easter Campaign",
        "type": "email",
        "status": "sent",
        "opens": "152",
        "clicks": "28"
      }
    ]
  }
}
```

#### GET `/api/crm-analytics/interaction-patterns`
Padrões e tendências de interações.

**Resposta:**
```json
{
  "success": true,
  "data": {
    "by_type": [
      {
        "type": "email",
        "count": 245,
        "pending": 5
      }
    ],
    "by_direction": [
      { "direction": "inbound", "count": 280 },
      { "direction": "outbound", "count": 145 }
    ],
    "avg_resolution_time": [
      {
        "type": "email",
        "total": 150,
        "avg_hours_to_resolve": 4.25
      }
    ],
    "top_customers": [
      {
        "id": 5,
        "name": "João Silva",
        "email": "joao@example.com"
      }
    ]
  }
}
```

#### GET `/api/crm-analytics/customer-journey/{customerId}`
Análise completa da jornada de um cliente.

**Parâmetros de Query:**
- `days` (int, 1-365) - Período em dias (padrão: 90)

**Resposta:**
```json
{
  "success": true,
  "data": {
    "customer": {
      "id": 5,
      "name": "João Silva",
      "email": "joao@example.com",
      "total_spent": 15000.00,
      "total_bookings": 8,
      "created_at": "2025-01-15T10:00:00Z"
    },
    "interactions_count": 12,
    "interactions": [
      {
        "id": 145,
        "type": "email",
        "direction": "inbound",
        "status": "completed",
        "created_at": "2026-03-28T14:30:00Z"
      }
    ],
    "bookings_count": 3,
    "bookings": [
      {
        "id": 89,
        "title": "Hotel Resort - 3 noites",
        "status": "confirmed",
        "total_value": 4500.00,
        "created_at": "2026-03-15T09:00:00Z"
      }
    ],
    "recent_campaigns": [ /* ... */ ],
    "period_days": 90
  }
}
```

---

## 🔐 Autenticação

Todas as APIs requerem token JWT no header `Authorization`:

```bash
Authorization: Bearer <jwt_token>
```

**Permissões Necessárias:**
- `GET` endpoints: `admin`, `manager`, `user`
- `POST` endpoints: `admin`, `manager`
- `PUT` endpoints: `admin`, `manager`
- `DELETE` endpoints: `admin` apenas

---

## 📈 Logs de Auditoria

Todas as operações são registradas na tabela `audit_logs`:

```json
{
  "user_id": 1,
  "action": "CREATE",
  "resource": "campaigns",
  "resource_id": 45,
  "details": {
    "name": "Easter Campaign",
    "type": "email"
  },
  "timestamp": "2026-04-01T10:00:00Z"
}
```

---

## 🧪 Exemplo de Uso

### Criar uma Campanha e Registrar Interação

```bash
# 1. Criar campanha de email
curl -X POST http://localhost:5000/api/campaigns \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Easter Special",
    "type": "email",
    "description": "Oferta especial de Páscoa",
    "content": {
      "subject": "🐣 Oferta Especial de Páscoa",
      "body": "Não perca!"
    }
  }'

# 2. Registrar interação do cliente
curl -X POST http://localhost:5000/api/interactions \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": 5,
    "type": "email",
    "direction": "inbound",
    "subject": "Interesse na oferta",
    "content": "Gostaria de saber mais sobre..."
  }'

# 3. Consultar dashboard
curl -X GET http://localhost:5000/api/crm-analytics/dashboard \
  -H "Authorization: Bearer <token>"
```

---

## ✅ Commits

```
31c9cffb - Adicionar API de campanhas - integração incremental do CRM
ce7b1738 - Atualização do .gitignore com regras definitivas
a910a20c - docs: adicionar guias de setup, deployment e CI/CD
```

---

## 🚀 Próximas Etapas

1. Implementar API de segmentos de clientes
2. Criar endpoints de integração com sistemas externos
3. Adicionar testes automatizados
4. Otimizar queries e adicionar caching
5. Implementar webhooks para eventos CRM

---

## 📝 Notas

- Todos os endpoints usam paginação para melhor performance
- Filtros são case-insensitive
- Datas sempre retornam em formato ISO8601 UTC
- Respostas de erro seguem padrão: `{ success: false, error: { code, message } }`
