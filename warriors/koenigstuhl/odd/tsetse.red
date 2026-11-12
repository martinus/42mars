;redcode-94nop test
;name Tsetse
;author P.Kline
;assert CORESIZE == 8000
;strategy 1. decoy to beat qscan
;strategy 2. locate Jedimp's boot code
;strategy 3. put program in safe position to attack Jedimp's
;strategy    first launched copy
;strategy 4. spiral wipe once with spl, then with dat
;strategy 5. after many trials, minor tweaks have eliminated
;strategy    many rare but recurring losses
; KOFACOTO-1

aStep     equ    55

aDecoy    equ    (aStart-300)
aStart    mov.x  #1       ,>aDecoy      ; decoy @ -300 foils much of the qscan
          djn.b  -1       ,<aDecoy+13   

aNext     add    aIncr    ,aPtr         ; search for Jedimp's boot code
aScan     jmn.f  aFind    ,*aPtr
          jmz.f  aNext    ,@aPtr
          mov.x  aPtr     ,aPtr
aFind     add.a  #104     ,aPtr         ; locate trailing bytes
          sub.a  #4       ,aPtr
          jmz.f  -1       ,*aPtr
          sub.a  #57-1305 ,aPtr         ; offset for J's boot plus a little
          mov    <vEnd    ,{aPtr        ; copy spl-dat clear to safe place
          djn    -1       ,#vEnd-vPtr   ; and spiral-spl his first copy
          
aPtr      jmp    *aStart+153 ,aStart+153+aStep
aIncr     dat    aStep*2  ,aStep*2
      for 72
          dat    0,0
      rof
vGate
vPtr      jmp    vSpl       ,vEnd+59
          dat    0          ,0
          dat    0          ,0
vSpl      spl    #vClr-vPtr ,#vEnd+2-vGate
          mov    *vPtr      ,<-1241     ; spiral wipe once with spl
          mov    *vPtr      ,@vGate     ; then continuously with dat
          add    #1143      ,vGate
          jmp    -2         
vClr      dat    vClr-vPtr  ,-1-vGate
vEnd      dat    0          ,0

          end    aStart

