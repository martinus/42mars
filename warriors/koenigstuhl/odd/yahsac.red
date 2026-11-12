;name YAHSAC
;author Robert Macrae after Paul Kline
;strategy Carpet everything or get dusted
;         HSA scanner with slightly larger step sizes that
;         may raise efficiency against other scanners
;assert 1

for CORESIZE==800
   Start1 equ 40
   Start2 equ 400
   Step2  equ 13
rof

for CORESIZE==8000
   Start1 equ 115
   Start2 equ 4000
   Step2  equ 13
rof

for CORESIZE==55440
   Start1 equ 215
   Start2 equ 26000
   Step2  equ 17                         ; a guess
rof

tEnd      equ    (tSpl+4)

tPtr      dat    Start1   ,Start2        ; widely-spaced pointers

for 5
          dat    0        ,0
rof
          
tWipe     mov    tSpl     ,<tPtr         ; positive wipe of opponent
          mov    >tPtr    ,>tPtr
          jmn.f  tWipe    ,>tPtr         

tLoop     sub.x  *pScan   ,@tScan        ; increment and look
          sne.f  *tPtr    ,@tPtr
tScan     sub.x  #-Step2  ,tPtr          ; increment and look
          jmn.f  tSelf    ,@tPtr
          jmz.f  tLoop    ,*tPtr
pScan     mov.x  @tScan   ,@tScan        ; swap pointers for attack
tSelf     slt.b  @tScan   ,#tEnd-tPtr    ; self-check
          djn    tWipe    ,@tScan        ;   go to attack
          djn    *pScan   ,#13           ; after 13 self-scans
          jmp    *pScan   ,}tWipe        ;   switch to dat-wiping

          dat    0        ,0

tSpl      spl    #1       ,{1
      
          end    tScan+1

