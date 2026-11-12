;redcode-94
;name AntiJed
;author Ayan Chakrabarti
;assert CORESIZE == 8000
; KOFACOTO-1

tPtr      dat    100 ,4100-4             ; widely-spaced pointers
          dat    0,0
          dat    0,0
          dat    0,0
          dat    0,0
          dat    0,0
          
tWipe     mov    tSpl     ,<tPtr         ; positive wipe of opponent
          mov    >tPtr    ,>tPtr
          jmn.f  tWipe    ,>tPtr
          
tScan     sub.x  #-12     ,tPtr          ; increment and look
          sne    *tPtr    ,@tPtr
          sub.x  *pScan   ,@tScan        ; increment and look
          jmn.f  tSelf    ,@tPtr
          jmz.f  tScan    ,*tPtr
pScan     mov.x  @tScan   ,@tScan        ; swap pointers for attack
tSelf     slt.b  @tScan   ,#tEnd+4-tPtr  ; self-check
          djn    tWipe    ,@tScan        ;   go to attack
          djn    *pScan   ,#13           ; after 13 self-scans
          jmp    *pScan   ,}tWipe        ;   switch to dat-wiping
          dat    0,0
tSpl      spl    #1,{1143
          dat    0,0
          dat    0,0
tEnd      dat 0,0

tDecoy    mov bomb,>bomb
          djn -1,#13
          jmp tScan+1
bomb      dat -700,-700

          end    tDecoy

