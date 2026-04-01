# 📊 Fase 3: Sincronização e Integração de Dados CRM

**Data:** 2 de Abril de 2026  
**Status:** ✅ Concluído  
**Branch:** `upgrade/align-crm-rsv360`

---

## 📋 Resumo das Mudanças

Esta fase implementou sistemas robustos de sincronização e integração entre o backend legado (v1) e o novo backend com Drizzle ORM (v2).

### APIs Implementadas:

1. **API de Sincronização** (`/api/sync`) - Sincronização unidirecional de dados
2. **API de Integração** (`/api/integration`) - Integração bidirecional com v2

---

## 🔄 Endpoints de Sincronização

### GET `/api/sync/status`
Obter status geral de sincronização e saúde dos dados.

**Resposta:**
```json
{
  "success": true,
  "data": {
    "status": "completed",
    "last_sync": {
      "id": 125,
      "entity_type": "customers",
      "records_processed": 1250,
      "records_succeeded": 1248,
      "records_failed": 2,
      "status": "completed",
      "completed_at": "2026-04-01T14:30:00Z"
    },
    "table_stats": {
      "customers": 1250,
      "campaigns": 45,
      "interactions": 425,
      "bookings": 2100
    },
    "recent_syncs": [/* last 10 syncs */]
  }
}
```

### POST `/api/sync/customers`
Sincronizar dados de clientes.

**Parâmetros:**
```json
{
  "batch_size": 100,
  "skip_duplicates": true
}
```

**Resposta:**
```json
{
  "success": true,
  "data": {
    "total": 1250,
    "succeeded": 1248,
    "failed": 2,
    "errors": [
      {
        "customer_id": 145,
        "error": "Invalid email format"
      }
    ]
  }
}
```

### POST `/api/sync/campaigns`
Sincronizar dados de campanhas.

**Validações:**
- Campo `name` deve estar preenchido
- Campo `type` deve ser um dos: `email`, `sms`, `push`, `social`

### POST `/api/sync/interactions`
Sincronizar dados de interações.

**Validações:**
- Campo `customer_id` é obrigatório
- Campo `type` é obrigatório
- `direction` deve ser `inbound` ou `outbound`

### POST `/api/sync/bookings`
Sincronizar dados de reservas.

**Validações:**
- Campo `customer_id` é obrigatório
- Campo `total_value` deve ser positivo

### POST `/api/sync/validate`
Validar integridade dos dados antes de sincronizar.

**Parâmetros:**
```json
{
  "entity_type": "customers"
}
```

**Resposta:**
```json
{
  "success": true,
  "data": {
    "entity_type": "customers",
    "is_valid": true,
    "total_records": 1250,
    "valid_records": 1248,
    "invalid_records": 2,
    "warnings": [
      {
        "record_id": 42,
        "warnings": ["Negative total_spent"]
      }
    ],
    "errors": [
      {
        "record_id": 145,
        "issues": ["Missing email", "Invalid email format"]
      }
    ]
  }
}
```

---

## 🔗 Endpoints de Integração

### GET `/api/integration/health`
Verificar saúde da integração entre v1 e v2.

**Resposta:**
```json
{
  "success": true,
  "data": {
    "backend_v1": {
      "status": "ok",
      "timestamp": "2026-04-01T14:30:00Z"
    },
    "backend_v2": {
      "status": "ok",
      "timestamp": "2026-04-01T14:30:00Z",
      "error": null
    }
  }
}
```

### POST `/api/integration/sync-all`
Sincronizar todos os dados entre v1 e v2.

**Parâmetros (Opcional):**
```json
{
  "entities": ["customers", "campaigns", "interactions", "bookings"]
}
```

**Resposta:**
```json
{
  "success": true,
  "data": {
    "customers": {
      "status": "success",
      "records_sent": 1250,
      "backend_v2_response": { /* response from v2 */ }
    },
    "campaigns": {
      "status": "success",
      "records_sent": 45
    },
    "interactions": {
      "status": "success",
      "records_sent": 425
    },
    "bookings": {
      "status": "error",
      "error": "Connection timeout"
    }
  }
}
```

### GET `/api/integration/compare/{entity}`
Comparar dados entre v1 e v2.

**Exemplo: GET `/api/integration/compare/customers`**

**Resposta:**
```json
{
  "success": true,
  "data": {
    "entity": "customers",
    "backend_v1": {
      "total_records": 1250,
      "sample_records": 100
    },
    "backend_v2": {
      "total_records": 1248,
      "sample_records": 98
    },
    "differences": {
      "count_diff": 2,
      "records_only_in_v1": [],
      "records_only_in_v2": []
    }
  }
}
```

### POST `/api/integration/merge-customer`
Mesclar dados de cliente de ambos os sistemas.

**Parâmetros:**
```json
{
  "customer_id": 42,
  "priority": "merge"
}
```

**Valores de Priority:**
- `v1` - Usar dados do v1 (sobrescreve v2)
- `v2` - Usar dados do v2 (sobrescreve v1)
- `merge` - Mesclar dados (padrão, toma valores mais recentes)

**Resposta:**
```json
{
  "success": true,
  "data": {
    "customer_id": 42,
    "merged": {
      "id": 42,
      "name": "João Silva",
      "email": "joao@example.com",
      "total_spent": 15000.00,
      "total_bookings": 8,
      "merged_at": "2026-04-01T14:30:00Z",
      "last_sync": "2026-04-01T14:30:00Z"
    }
  }
}
```

### GET `/api/integration/mapping`
Obter mapeamento de campos entre v1 e v2.

**Resposta:**
```json
{
  "success": true,
  "data": {
    "customers": {
      "v1": ["id", "name", "email", "city", "state", ...],
      "v2": ["id", "name", "email", "address_city", "address_state", ...],
      "mapping": {
        "city": "address_city",
        "state": "address_state"
      }
    }
  }
}
```

**Mapeamentos Configurados:**

| v1 Field | v2 Field | Tipo |
|----------|----------|------|
| `city` | `address_city` | customers |
| `state` | `address_state` | customers |

### GET `/api/integration/sync-logs`
Obter histórico de sincronizações.

**Parâmetros de Query:**
- `limit` (int) - Máximo de registros (padrão: 50, máx: 100)

**Resposta:**
```json
{
  "success": true,
  "data": {
    "total": 50,
    "logs": [
      {
        "id": 125,
        "entity_type": "customers",
        "sync_type": "full",
        "records_processed": 1250,
        "records_succeeded": 1248,
        "records_failed": 2,
        "status": "completed",
        "started_at": "2026-04-01T14:20:00Z",
        "completed_at": "2026-04-01T14:30:00Z"
      }
    ]
  }
}
```

---

## 🗄️ Tabela de Suporte

### `sync_logs` Table

Rastreia todas as operações de sincronização.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | INT | ID primário |
| `entity_type` | VARCHAR(50) | Tipo de entidade (customers, campaigns, etc) |
| `sync_type` | VARCHAR(50) | Tipo de sync (full, incremental, validation) |
| `records_processed` | INT | Total de registros processados |
| `records_succeeded` | INT | Registros sincronizados com sucesso |
| `records_failed` | INT | Registros que falharam |
| `status` | VARCHAR(50) | Status (in_progress, completed, failed) |
| `error_message` | TEXT | Mensagem de erro (se houver) |
| `started_at` | TIMESTAMP | Quando a sincronização começou |
| `completed_at` | TIMESTAMP | Quando a sincronização terminou |
| `created_at` | TIMESTAMP | Quando o log foi criado |

---

## 🔐 Validação de Dados

### Regras de Validação por Entidade

#### Customers
- ✅ Email: obrigatório, formato válido
- ✅ Name: obrigatório, não vazio
- ⚠️ Warning: `total_spent < 0`

#### Campaigns
- ✅ Name: obrigatório
- ✅ Type: obrigatório, um de [email, sms, push, social]
- ⚠️ Warning: tipo desconhecido

#### Interactions
- ✅ Customer_id: obrigatório
- ✅ Type: obrigatório
- ✅ Direction: obrigatório, um de [inbound, outbound]
- ⚠️ Warning: direção inválida

#### Bookings
- ✅ Customer_id: obrigatório
- ✅ Total_value: obrigatório, >= 0

---

## 🔄 Fluxo de Sincronização

```
┌─────────────────┐
│  Backend V1     │
│   Banco Legado  │
└────────┬────────┘
         │
         │ POST /api/sync/{entity}
         │ ou
         │ POST /api/integration/sync-all
         │
         ▼
    ┌──────────────────┐
    │  Validação de    │
    │  Integridade     │
    └────────┬─────────┘
             │
         ✅ ou ❌
             │
         ┌───┴────┐
         │        │
        ✅       ❌
         │        │
         │    ┌───────────┐
         │    │   Erro    │
         │    │  Registro │
         │    └───────────┘
         │
         ▼
    ┌──────────────────────┐
    │  Mapear Campos       │
    │  v1 → v2             │
    └────────┬─────────────┘
             │
             ▼
    ┌──────────────────────┐
    │  Backend V2          │
    │  (Drizzle ORM)       │
    └──────────────────────┘
             │
             ▼
    ┌──────────────────────┐
    │  Registrar em        │
    │  sync_logs           │
    └──────────────────────┘
```

---

## 📈 Estatísticas do Código

### Arquivos Criados/Modificados
- `backend/src/routes/sync.js` (421 linhas)
- `backend/src/routes/integration.js` (350 linhas)
- `backend/migrations/007_create_sync_logs_table.js` (28 linhas)
- `backend/src/server.js` (2 imports + 2 route registrations)

### Endpoints Implementados: 8
- Sincronização: 5 endpoints
- Integração: 5 endpoints

---

## 🧪 Exemplo de Uso Completo

### 1. Validar dados antes de sincronizar
```bash
curl -X POST http://localhost:5000/api/sync/validate \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "entity_type": "customers"
  }'
```

### 2. Verificar saúde da integração
```bash
curl -X GET http://localhost:5000/api/integration/health \
  -H "Authorization: Bearer <token>"
```

### 3. Sincronizar clientes
```bash
curl -X POST http://localhost:5000/api/sync/customers \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "batch_size": 100,
    "skip_duplicates": true
  }'
```

### 4. Sincronizar com v2
```bash
curl -X POST http://localhost:5000/api/integration/sync-all \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "entities": ["customers", "campaigns", "interactions", "bookings"]
  }'
```

### 5. Comparar dados
```bash
curl -X GET http://localhost:5000/api/integration/compare/customers \
  -H "Authorization: Bearer <token>"
```

### 6. Mesclar cliente
```bash
curl -X POST http://localhost:5000/api/integration/merge-customer \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": 42,
    "priority": "merge"
  }'
```

### 7. Ver histórico de sincronizações
```bash
curl -X GET http://localhost:5000/api/integration/sync-logs \
  -H "Authorization: Bearer <token>"
```

---

## ⚠️ Considerações Importantes

### Recuperação de Falhas
- Cada falha é registrada com detalhes no `sync_logs`
- Possibilidade de repetir sincronizações falhas por entidade
- Validação prévia reduz erros

### Performance
- Processa em lotes para melhor performance
- Índices na tabela `sync_logs` para queries rápidas
- Timeout configurável para chamadas ao v2

### Segurança
- Apenas `admin` pode iniciar sincronizações
- Auditoria completa de todas operações
- Validação rigorosa de dados

### Dados Sensíveis
- Passwords não são sincronizados
- Informações de pagamento requerem validação especial
- Compliância com LGPD ao sincronizar dados pessoais

---

## 🚀 Próximas Melhorias

1. **Sync Incremental** - Sincronizar apenas mudanças recentes
2. **Webhooks** - Notificações em tempo real de mudanças
3. **Rollback** - Reverter sincronizações com falha
4. **Scheduling** - Syncronizações agendadas automaticamente
5. **Audit Trail Detalhado** - Rastrear cada mudança individual

---

## 📞 Contatos

**Lead Técnico:** Dev Team  
**Slack Channel:** #crm-sync  

---

*Última atualização: 2 de Abril de 2026, 15:00 UTC*
