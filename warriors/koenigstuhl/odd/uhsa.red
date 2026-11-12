;redcode-94nop
;name uHSA
;author P.Kline
;assert CORESIZE == 8000
;strategy HSA-type scanner in 8 lines
;optimax scn

tLoop     add.ab #12   ,#115
tScan     jmz.f  -1       ,@tLoop
          slt.b  tLoop    ,#10
          mov    tSpl     ,@tLoop
          jmz.f  tScan    ,>tLoop
          djn    tLoop    ,#10
tSpl      spl    #0       ,0
          mov    1        ,<-2
          end    tScan

