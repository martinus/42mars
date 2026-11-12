;redcode
;name unnamed
;author P. Kline
;assert 1

        mov.i #0         ,<1 
scan1   jmz.f #0         ,-10*2667 
attack  jmp   {-1        ,}0 
start   sne   start-2667 ,start-2667-7 
        seq   start-5334 ,start-5334-7 
        jmz.f reloc      ,<cpt+2 
        jmz.f scan1      ,<cpt+2 
; 
;relocate to avoid being overrun at startup 
; 
reloc   mov   <cpt       ,{cpt 
        djn   -1         ,#3 
cpt     jmp   @100       ,attack+1 
        end   start

;	***** SCORE: 100% WINS *****
