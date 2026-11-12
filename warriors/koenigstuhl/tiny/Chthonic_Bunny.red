;redcode-tiny
;author inversed
;name AR: Chthonic Bunny
;strategy Replicator
;strategy Evolved with ArmsRace
;date 2022.05.12
;assert CORESIZE == 800

org     1

dat.b   } 651 , {   0
mov.i   { 399 , $ 308
mov.i   > 537 , }  17
mov.i   } 512 , $ 688
spl.b   {   3 , } 627
mov.i   >   6 , $ 380
mov.i   { 132 , $ 229
mov.i   }   6 , { 666
mov.i   < 532 , { 500
mov.i   > 513 , $ 563
mov.i   < 357 , { 523
spl.b   # 674 , < 484   ; Head
mov.i   > 597 , { 584
mov.i   > 440 , { 341
mov.i   }  -1 , { 425
spl.b   # 377 , }   2
mov.i   } -11 , }   2   ; Replication
mov.i   > 165 , { -17
djn.f   { 118 , { 399   ; Process transfer
mov.i   }  45 , { 534

