;redcode-94
;name Test Opponent
;author P.Kline
;strategy 1996-02-14
;assert CORESIZE==8000

start    spl   1          ;
         mov   -1,0       ;  make 6 processes
         spl   1          ;
s0       spl   @0,{2240   ;  spawn a new spiral
         mov   }-1,>-1
         spl   @0,1143    ;  spawn the next component in this spiral
         mov   }-1,>-1
         spl   #0         ;  stay here while spiral is built
         mov.i #0,1143    ;  
         end
