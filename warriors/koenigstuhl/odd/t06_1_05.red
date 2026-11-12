;name Sprites
;author P.Kline
;strategy qscan, paper
;assert 1

qDecoy   equ     (-11*13)
aSkip    equ     199
aBomb    dat     -70          ,1

         dat     aSkip*8      ,aSkip*20
aTab     dat     aSkip*4      ,aSkip*4
         dat     aSkip*12     ,aSkip*36

aStart   sne     aAttack+aSkip*1 ,aAttack+aSkip*2
         seq     aAttack+aSkip*3 ,aAttack+aSkip*4
         jmp     aLoc            ,             >qDecoy*8
         sne     aAttack+aSkip*5 ,aAttack+aSkip*6
         seq     aAttack+aSkip*7 ,aAttack+aSkip*8
         jmp     aOffset         ,             >qDecoy*9
         sne     aAttack+aSkip*21,aAttack+aSkip*22
         seq     aAttack+aSkip*23,aAttack+aSkip*24
         jmp     aOffset         ,<aDecode
         sne     aAttack+aSkip*37,aAttack+aSkip*38
         seq     aAttack+aSkip*39,aAttack+aSkip*40
         jmp     aOffset         ,>aDecode
         sne     aAttack+aSkip*41,aAttack+aSkip*42
         seq     aAttack+aSkip*43,aAttack+aSkip*44
         jmp     aDecode         ,>aDecode
         sne     aAttack+aSkip*9 ,aAttack+aSkip*10
         seq     aAttack+aSkip*11,aAttack+aSkip*12
         jmp     aDecode         ,             >qDecoy*10
         sne     aAttack+aSkip*25,aAttack+aSkip*26
         seq     aAttack+aSkip*27,aAttack+aSkip*28
         jmp     aDecode         ,<aDecode
         sne     aAttack+aSkip*13,aAttack+aSkip*14
         seq     aAttack+aSkip*15,aAttack+aSkip*16
         jmp     aDecode         ,{aDecode
         sne     aAttack+aSkip*29,aAttack+aSkip*30
         seq     aAttack+aSkip*31,aAttack+aSkip*32
         djn.f   aDecode         ,aDecode
         sne     aAttack+aSkip*17,aAttack+aSkip*18
         seq     aAttack+aSkip*19,aAttack+aSkip*20
         jmp     aDecode         ,}aDecode
         jmp     pStart          ,             >qDecoy*7

aDecode  add.ab  aTab         ,aTab
aOffset  add.b   @aDecode     ,aAttack
aLoc     sne     aBomb-1      ,@aAttack
         add     #aSkip       ,aAttack
         sne     aBomb-1      ,@aAttack
         add     #aSkip       ,aAttack
         sne     aBomb-1      ,@aAttack
         add     #aSkip       ,aAttack
         mov     aBomb        ,@1
aAttack  mov     aBomb        ,*aSkip
         add     #6           ,-1
         djn     -3           ,#15
         jmp     pStart       ,>qDecoy*6
     for 80
         dat     0            ,0
     rof
qStep2   equ     (851)
qStep    equ     (2633)
pStart   mov     <rCopy       ,{rCopy
         mov     <rCopy       ,{rCopy
         spl     2            , }qDecoy*11
qtab2    spl     1            , }qDecoy*12
         spl     1            , }qDecoy*13

         mov     <rCopy       ,{rCopy
rCopy    spl     rPap+8+4620  ,rPap+8

rPap     mov     <1           ,{1
         spl     qPap+6930+6  ,qPap+6
qPap     spl     @0           ,>qStep
         mov     }qPap        ,>qPap
         mov     {qPap        ,<1
         spl     @0           ,>qStep2
         mov.i   #6930-1-3080 ,}3080

         end     aStart

