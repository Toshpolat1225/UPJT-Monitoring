import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { exportDailyEntriesToExcel } from '@/api/exports';
import { downloadFile } from '@/utils/download';

export const useExportDailyEntries = () => {
  return useMutation({
    mutationFn: (params: { year: number; month: number }) => exportDailyEntriesToExcel(params),
    onMutate: () => {
      // Toast ID saqlab olinadi
      const toastId = toast.loading('Hisobot tayyorlanmoqda, kuting...');
      return { toastId };
    },
    onSuccess: (data, _variables, context) => {
      toast.success('Hisobot muvaffaqiyatli yuklab olindi!', { id: context?.toastId });
      downloadFile(data, `daily_entries_${new Date().toISOString().slice(0, 10)}.xlsx`);
    },
    onError: (error: Error, _variables, context) => {
      toast.error('Hisobotni yuklab olishda xatolik yuz berdi', {
        id: context?.toastId,
        description: error.message || 'Server bilan bog‘lanishda xatolik.',
      });
    },
  });
};