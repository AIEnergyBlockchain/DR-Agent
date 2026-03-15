"""Async task queue abstraction for background chain operations.

Provides a pluggable queue interface with:
  - InMemoryTaskQueue: for testing and simulated mode
  - (Future) CeleryTaskQueue: for production with Redis backend

Task types:
  - confirm_tx: poll chain for tx confirmation
  - bridge_relay: relay cross-chain bridge transfer
  - icm_deliver: deliver ICM message to destination
  - settle_event: async event settlement
"""

from __future__ import annotations

import uuid
from collections import deque
from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Any, Protocol


class TaskType(Enum):
    CONFIRM_TX = "confirm_tx"
    BRIDGE_RELAY = "bridge_relay"
    ICM_DELIVER = "icm_deliver"
    SETTLE_EVENT = "settle_event"


class TaskStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class Task:
    task_id: str
    task_type: TaskType
    payload: dict[str, Any]
    status: TaskStatus
    result: dict[str, Any] | None = None
    error: str | None = None
    retry_count: int = 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "task_id": self.task_id,
            "task_type": self.task_type.value,
            "payload": self.payload,
            "status": self.status.value,
            "result": self.result,
            "error": self.error,
            "retry_count": self.retry_count,
        }


class TaskQueue(Protocol):
    def enqueue(self, task_type: TaskType, payload: dict[str, Any]) -> Task: ...
    def dequeue(self) -> Task | None: ...
    def complete(self, task_id: str, result: dict[str, Any] | None = None) -> Task: ...
    def fail(self, task_id: str, error: str) -> Task: ...
    def get(self, task_id: str) -> Task | None: ...
    def pending_count(self) -> int: ...


class InMemoryTaskQueue:
    def __init__(self, max_retries: int = 3):
        self._tasks: dict[str, Task] = {}
        self._queue: deque[str] = deque()
        self._max_retries = max_retries

    def enqueue(self, task_type: TaskType, payload: dict[str, Any]) -> Task:
        task_id = f"task-{uuid.uuid4().hex[:12]}"
        task = Task(
            task_id=task_id,
            task_type=task_type,
            payload=payload,
            status=TaskStatus.PENDING,
        )
        self._tasks[task_id] = task
        self._queue.append(task_id)
        return task

    def dequeue(self) -> Task | None:
        while self._queue:
            task_id = self._queue.popleft()
            task = self._tasks.get(task_id)
            if task and task.status == TaskStatus.PENDING:
                task.status = TaskStatus.RUNNING
                return task
        return None

    def complete(
        self, task_id: str, result: dict[str, Any] | None = None
    ) -> Task:
        task = self._require(task_id)
        task.status = TaskStatus.COMPLETED
        task.result = result
        return task

    def fail(self, task_id: str, error: str) -> Task:
        task = self._require(task_id)
        task.status = TaskStatus.FAILED
        task.error = error
        return task

    def retry(self, task_id: str) -> Task:
        task = self._require(task_id)
        if task.retry_count >= self._max_retries:
            raise ValueError(
                f"max retries ({self._max_retries}) exceeded for task {task_id}"
            )
        task.status = TaskStatus.PENDING
        task.error = None
        task.retry_count += 1
        self._queue.append(task_id)
        return task

    def get(self, task_id: str) -> Task | None:
        return self._tasks.get(task_id)

    def pending_count(self) -> int:
        return sum(
            1 for t in self._tasks.values() if t.status == TaskStatus.PENDING
        )

    def list_by_type(self, task_type: TaskType) -> list[Task]:
        return [
            t for t in self._tasks.values() if t.task_type == task_type
        ]

    def _require(self, task_id: str) -> Task:
        task = self._tasks.get(task_id)
        if task is None:
            raise ValueError(f"task not found: {task_id}")
        return task
