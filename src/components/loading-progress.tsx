interface LoadingProgressProps {
  progress: number;
  isLoading: boolean;
  error: string | null;
}

export function LoadingProgress({
  progress,
  isLoading,
  error,
}: LoadingProgressProps) {
  if (error) {
    return (
      <div
        style={{
          position: "fixed",
          top: "20px",
          right: "20px",
          background: "#ff4444",
          color: "white",
          padding: "10px 20px",
          borderRadius: "5px",
          zIndex: 1000,
        }}
      >
        Error: {error}
      </div>
    );
  }

  if (!isLoading) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: "20px",
        right: "20px",
        background: "#2196F3",
        color: "white",
        padding: "10px 20px",
        borderRadius: "5px",
        zIndex: 1000,
      }}
    >
      Loading: {Math.round(progress * 100)}%
      <div
        style={{
          width: "200px",
          height: "4px",
          background: "rgba(255, 255, 255, 0.3)",
          marginTop: "5px",
          borderRadius: "2px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${progress * 100}%`,
            height: "100%",
            background: "white",
            transition: "width 0.3s ease",
          }}
        />
      </div>
    </div>
  );
}
