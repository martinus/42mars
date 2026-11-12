;redcode-94
;name test opponent
;author P.Kline
;strategy paper-imp
;assert CORESIZE == 8000

; example code posted to rec.games.corewar on 14th Feb 1996

start    spl   1          ;
         mov   -1,0       ;  make 6 processes
         spl   1          ;
s0       spl   @0,{2240   ;  spawn a new spiral
         mov   }-1,>-1
         spl   @0,1143    ;  spawn the next component in this spiral
         mov   }-1,>-1
         spl   #0         ;  stay here while spiral is built
         mov.i #0,1143    ;  

