#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype,
    log, symbol_short,
    Address, Env, String, Symbol, Vec,
};

// ── Storage Keys ──────────────────────────────────────────
const EXECUTIONS_KEY: Symbol = symbol_short!("EXECS");
const COUNT_KEY: Symbol = symbol_short!("COUNT");

// ── Data Types ────────────────────────────────────────────
#[contracttype]
#[derive(Clone)]
pub struct WorkflowExecution {
    pub execution_id: u64,
    pub workflow_id: String,
    pub executor: Address,
    pub node_count: u32,
    pub status: Symbol,    // "success" or "failed"
    pub timestamp: u64,
}

// ── Contract ──────────────────────────────────────────────
#[contract]
pub struct WorkflowRegistry;

#[contractimpl]
impl WorkflowRegistry {

    /// Log a workflow execution on-chain.
    /// Called by the StellrFlow bot after a workflow completes.
    pub fn log_execution(
        env: Env,
        executor: Address,
        workflow_id: String,
        node_count: u32,
        success: bool,
    ) -> u64 {
        // Require the caller to authorize this
        executor.require_auth();

        // Increment execution counter
        let count: u64 = env
            .storage()
            .persistent()
            .get(&COUNT_KEY)
            .unwrap_or(0);
        let execution_id = count + 1;

        let status = if success {
            symbol_short!("success")
        } else {
            symbol_short!("failed")
        };

        let execution = WorkflowExecution {
            execution_id,
            workflow_id: workflow_id.clone(),
            executor: executor.clone(),
            node_count,
            status,
            timestamp: env.ledger().timestamp(),
        };

        // Persist the execution record
        env.storage()
            .persistent()
            .set(&execution_id, &execution);

        // Update counter
        env.storage()
            .persistent()
            .set(&COUNT_KEY, &execution_id);

        log!(&env, "StellrFlow: workflow {} executed by {} (nodes: {}, success: {})",
            workflow_id, executor, node_count, success);

        execution_id
    }

    /// Get a specific execution by ID.
    pub fn get_execution(env: Env, execution_id: u64) -> Option<WorkflowExecution> {
        env.storage().persistent().get(&execution_id)
    }

    /// Get total number of executions logged.
    pub fn get_count(env: Env) -> u64 {
        env.storage().persistent().get(&COUNT_KEY).unwrap_or(0)
    }

    /// Get the most recent N executions (up to 10).
    pub fn get_recent(env: Env, limit: u32) -> Vec<WorkflowExecution> {
        let count: u64 = env
            .storage()
            .persistent()
            .get(&COUNT_KEY)
            .unwrap_or(0);

        let actual_limit = (limit.min(10)) as u64;
        let start = if count > actual_limit {
            count - actual_limit + 1
        } else {
            1
        };

        let mut results = Vec::new(&env);
        for id in start..=count {
            if let Some(exec) = env.storage().persistent().get::<u64, WorkflowExecution>(&id) {
                results.push_back(exec);
            }
        }
        results
    }
}

// ── Tests ─────────────────────────────────────────────────
#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env, String};

    #[test]
    fn test_log_and_retrieve() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, WorkflowRegistry);
        let client = WorkflowRegistryClient::new(&env, &contract_id);

        let executor = Address::generate(&env);
        let wf_id = String::from_str(&env, "wf-001");

        // Log a successful execution
        let exec_id = client.log_execution(&executor, &wf_id, &3, &true);
        assert_eq!(exec_id, 1);

        // Retrieve it
        let exec = client.get_execution(&1).unwrap();
        assert_eq!(exec.execution_id, 1);
        assert_eq!(exec.node_count, 3);
        assert_eq!(exec.status, symbol_short!("success"));
    }

    #[test]
    fn test_count_increments() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, WorkflowRegistry);
        let client = WorkflowRegistryClient::new(&env, &contract_id);

        let executor = Address::generate(&env);
        let wf_id = String::from_str(&env, "wf-002");

        client.log_execution(&executor, &wf_id, &2, &true);
        client.log_execution(&executor, &wf_id, &4, &false);

        assert_eq!(client.get_count(), 2);
    }
}
