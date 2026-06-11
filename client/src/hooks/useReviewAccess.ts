import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/api/api";

interface ReviewAccess {
  canReview: boolean;
  canReviewAppeals: boolean;
  isLoading: boolean;
}

export function useReviewAccess(): ReviewAccess {
  const { user } = useAuth();
  const [canReview, setCanReview] = useState(false);
  const [canReviewAppeals, setCanReviewAppeals] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    api
      .get("/api/submissions/review-access")
      .then((res) => {
        setCanReview(res.data?.canReview === true);
        setCanReviewAppeals(res.data?.canReviewAppeals === true);
      })
      .catch(() => {
        setCanReview(false);
        setCanReviewAppeals(false);
      })
      .finally(() => setIsLoading(false));
  }, [user?.id, user?.role, user?.internalCommittee, user?.college]);

  return { canReview, canReviewAppeals, isLoading };
}
