;redcode-94
;name Round4.2000
;author P.Kline
;assert CORESIZE == 8000
; KOFACOTO 4

tEnd      equ    (aClr+3)
cTest     MOV.I {-1       ,<-3
aPtr      jmp    aSpl     ,0
aKill     mov    13       ,<14

aStart    sne    aPtr+0105  ,aPtr+0205
          seq    aPtr+0305  ,aPtr+0405 
          mov    #0005      ,aPtr
          sne    aPtr+0505  ,aPtr+0605
          seq    aPtr+0705  ,aPtr+0805 
          mov    #0405      ,aPtr
          sne    aPtr+0905  ,aPtr+1005
          seq    aPtr+1105  ,aPtr+1205 
          mov    #0805      ,aPtr
          sne    aPtr+1305  ,aPtr+1405
          seq    aPtr+1505  ,aPtr+1605 
          mov    #1205      ,aPtr
          jmn    aSearch    ,aPtr
          sne    aPtr+1705  ,aPtr+1805
          seq    aPtr+1905  ,aPtr+2005 
          mov    #1605      ,aPtr
          sne    aPtr+2105  ,aPtr+2205
          seq    aPtr+2305  ,aPtr+2405 
          mov    #2005      ,aPtr
          sne    aPtr+2505  ,aPtr+2605
          seq    aPtr+2705  ,aPtr+2805 
          mov    #2405      ,aPtr
          sne    aPtr+2905  ,aPtr+3005
          seq    aPtr+3105  ,aPtr+3205 
          mov    #2805      ,aPtr
          jmn    aSearch    ,aPtr
          sne    aPtr+3305  ,aPtr+3405
          seq    aPtr+3505  ,aPtr+3605 
          mov    #3205      ,aPtr
          sne    aPtr+3705  ,aPtr+3805
          seq    aPtr+3905  ,aPtr+4005 
          mov    #3605      ,aPtr
          sne    aPtr+4105  ,aPtr+4205
          seq    aPtr+4305  ,aPtr+4405 
          mov    #4005      ,aPtr
          sne    aPtr+4505  ,aPtr+4605
          seq    aPtr+4705  ,aPtr+4805 
          mov    #4405      ,aPtr
          jmn    aSearch    ,aPtr
          sne    aPtr+4905  ,aPtr+5005
          seq    aPtr+5105  ,aPtr+5205 
          mov    #4805      ,aPtr
          sne    aPtr+5305  ,aPtr+5405
          seq    aPtr+5505  ,aPtr+5605 
          mov    #5205      ,aPtr
          sne    aPtr+5705  ,aPtr+5805
          seq    aPtr+5905  ,aPtr+6005 
          mov    #5605      ,aPtr
          sne    aPtr+6105  ,aPtr+6205
          seq    aPtr+6305  ,aPtr+6405 
          mov    #6005      ,aPtr
          jmn    aSearch    ,aPtr
          sne    aPtr+6505  ,aPtr+6605
          seq    aPtr+6705  ,aPtr+6805 
          mov    #6405      ,aPtr
          sne    aPtr+6905  ,aPtr+7005
          seq    aPtr+7105  ,aPtr+7205 
          mov    #6805      ,aPtr
          sne    aPtr+7305  ,aPtr+7405
          seq    aPtr+7505  ,aPtr+7605 
          mov    #7205      ,aPtr
          sne    aPtr+7705  ,aPtr+7805
          seq    aPtr+7905  ,aPtr+7905 
          mov    #7605      ,aPtr
       
aSearch   add    #100     ,aPtr
          jmz.f  aSearch  ,@aPtr
          jmn.f  #0       ,<aPtr
          add    #4       ,aPtr
          seq    cTest    ,@aPtr
          jmp    aSearch
        
          add    #2517    ,aPtr
          sub.ba aPtr     ,aPtr
          mov    aPtr     ,>aPtr
          mov    aKill    ,@aPtr
          jmp    bNext+1  ,0
          dat    0        ,0
aGate     dat    tEnd     ,tEnd
          dat    0        ,0
          dat    0        ,0
          dat    0        ,0
          dat    0        ,0
bPtr      dat    0        ,tEnd+100
aSpl      spl    #0       ,<aGate
aWipe     mov    @aClr    ,}aGate
          mov    @aClr    ,}aGate
          jmp    -2       ,<aGate

bWipe     mov.ba bPtr     ,aGate
          mov    bPtr     ,@1
          jmz.f  bNext    ,@bPtr-3120
          add    #-3120-(7*3),bPtr
bNext     add    #7       ,bPtr
          jmz.f  bNext    ,@bPtr
          slt    bPtr     ,#tEnd+6-bPtr
          jmp    bWipe
          djn    bNext    ,#6
          jmp    bNext    ,>aClr
          
aClr      spl    #0       ,{0


          end    aStart 
