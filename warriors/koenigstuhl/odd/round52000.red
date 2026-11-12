;redcode
;name Round5.2000
;kill Round5
;author P.Kline
;assert CORESIZE == 8000
;strategy simple pspacer
         
w0 EQU slHscan
w1 EQU slOsClear
PSTATE EQU 400

think   ldp.a    #0      ,in
        ldp.a    #PSTATE ,table
        mod.ba   *in     ,table
        stp.b    *table  ,#PSTATE
        
                        ; S  L W T
table   jmp }0   ,0891  ; 00 1 0 0
        dat #w0  ,0342  ; 01 2 0 1
        dat #w0  ,0343  ; 02 3 1 2
        dat #w0  ,0784  ; 03 4 1 3
        dat #w0  ,0587  ; 04 7 2 4
        dat #w1  ,0896  ; 05 6 5 5
        dat #w1  ,0347  ; 06 7 5 6
        dat #w1  ,0348  ; 07 8 6 7
        dat #w1  ,0843  ; 08 3 6 7                                                        
in      spl #0,10  ; must have non-zero b-field in the previous cell
        spl #0, 9
        jmp -6,11
        
clGate    jmp    7      ,-1
          dat    0      ,0
          dat    0      ,0
OsClear   add    clSpl  ,clGate
          sne    *clGate,@clGate
          add    clSpl  ,clGate
          sne    *clGate,@clGate
          djn.f  -4     ,<-1007
clSpl     spl    #13    ,#13
          mov    clBomb ,>clGate
          djn.f  -1     ,>clGate
clBomb    dat    <5335  ,2-clGate
          dat    0      ,0
          dat    0      ,0
          dat    0      ,0
          dat    0      ,0

btOsClear jmp    1200   ,clGate+15-btHscan

slOsClear mov    btOsClear  ,btHscan
slHscan   mov    <btHscan   ,{btHscan
          mov    <btHscan   ,{btHscan
          mov    <btHscan   ,{btHscan
          mov    <btHscan   ,{btHscan
          mov    <btHscan   ,{btHscan
btCount   djn    -5         ,#3
btHscan   jmp    Hscan+2400 ,Hscan+15

Hscan
tPtr      jmp    tNext+1  ,tEnd+18
          dat    0        ,0
          dat    0        ,0
          dat    0        ,0
tWipe     mov    tSpl     ,<tPtr
pPtr      mov    >tPtr    ,>tPtr
          jmn.f  tWipe    ,>tPtr
          mov    *tWipe   ,<tPtr
tNext     add    #9       ,@pPtr
          jmz.f  tNext    ,@tPtr          
tSelf     slt.b  @pPtr    ,#tEnd-tPtr
          jmp    tWipe    ,<tPtr
tCount    djn    tNext    ,#10
          jmp    tNext    ,}tWipe
tSpl      spl    #1       ,{1
          dat    0        ,0
          dat    0        ,0
          dat    0        ,0
tEnd      dat    0        ,0
          
          end    think
