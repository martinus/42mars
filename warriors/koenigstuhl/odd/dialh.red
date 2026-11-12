;redcode-94
;name Dial 'H' for Hero!
;author David Moore
;assert CORESIZE==8000 
; MINDISTANCE==100
;strategy find CIA by scanning for its decoy
;strategy vamp CIA so that it runs a safe self-splitting scanner
;strategy while I use my own HSA-style scanner
;strategy together we fight Evil Jedimp

      dat 0,0
tptr  dat 0,-MINDISTANCE

for 9
dat 0,0
rof

qstep equ 100
qn    equ  40  ;number of scans in unrolled loop

;oops, I missed CIA's decoy!
qmiss add.ab # 30,   qptr  ;adjust and scan again
      jmn.f   qdec, @qptr
      mov.ab  qptr,  qptr
      add.ab #qstep, qptr
      jmp     qst,   0

qscan sne last+MINDISTANCE+(qstep*16), last+MINDISTANCE+(qstep*17)
      seq last+MINDISTANCE+(qstep*18), last+MINDISTANCE+(qstep*19)
      mov.a #qstep*(16-qn-2), qadj
      sne last+MINDISTANCE+(qstep*12), last+MINDISTANCE+(qstep*13)
      seq last+MINDISTANCE+(qstep*14), last+MINDISTANCE+(qstep*15)
      mov.a #qstep*(12-qn-2), qadj
      sne last+MINDISTANCE+(qstep* 8), last+MINDISTANCE+(qstep* 9)
      seq last+MINDISTANCE+(qstep*10), last+MINDISTANCE+(qstep*11)
      mov.a #qstep*( 8-qn-2), qadj
      sne last+MINDISTANCE+(qstep* 4), last+MINDISTANCE+(qstep* 5)
      seq last+MINDISTANCE+(qstep* 6), last+MINDISTANCE+(qstep* 7)
      mov.a #qstep*( 4-qn-2), qadj
      sne last+MINDISTANCE+(qstep* 0), last+MINDISTANCE+(qstep* 1)
      seq last+MINDISTANCE+(qstep* 2), last+MINDISTANCE+(qstep* 3)
      mov.a #qstep*( 0-qn-2), qadj
      jmn.a qadj, qadj
      sne last+MINDISTANCE+(qstep*36), last+MINDISTANCE+(qstep*37)
      seq last+MINDISTANCE+(qstep*38), last+MINDISTANCE+(qstep*39)
      mov.a #qstep*(36-qn-2), qadj
      sne last+MINDISTANCE+(qstep*32), last+MINDISTANCE+(qstep*33)
      seq last+MINDISTANCE+(qstep*34), last+MINDISTANCE+(qstep*35)
      mov.a #qstep*(32-qn-2), qadj
      sne last+MINDISTANCE+(qstep*28), last+MINDISTANCE+(qstep*29)
      seq last+MINDISTANCE+(qstep*30), last+MINDISTANCE+(qstep*31)
      mov.a #qstep*(28-qn-2), qadj
      sne last+MINDISTANCE+(qstep*24), last+MINDISTANCE+(qstep*25)
      seq last+MINDISTANCE+(qstep*26), last+MINDISTANCE+(qstep*27)
      mov.a #qstep*(24-qn-2), qadj
      sne last+MINDISTANCE+(qstep*20), last+MINDISTANCE+(qstep*21)
      seq last+MINDISTANCE+(qstep*22), last+MINDISTANCE+(qstep*23)
      mov.a #qstep*(20-qn-2), qadj

qadj  add.ab    #0,  qptr
      add.ba  qptr,  qptr
qst   add.f   qadd,  qptr
qptr  sne   -qstep, last+MINDISTANCE+(qstep*(qn+1))
      add.f   qadd,  qptr
      sne    *qptr, @qptr
      jmp     qst,   0
      sne    @qptr,  top
      sub.ab #qstep, qptr
qdec  mov.b  @qptr,  qjb
      mod     qm,   @qptr
      jmn.f  qmiss, @qptr  ;did I scan CIA's decoy?

;yes, I found a decoy
      div.ab #11,    qjb   ;CIA's position can be determined
      mul.ab #-1,    qjb   ;by looking at any decoy cell
      add.ab #2491+(qptr-qjb), qjb
      add.b   qptr,  qjb
      sub.ba  qjb,   qjb
      mov     qjb,  >qjb   ;vamp CIA to "trap"
      mov     top,  >qjb   ;kill unneeded processes
      djn      -1,  #6
      jmp    scan,   0

qm    dat 17, 11
qadd  dat qstep*2, qstep*2
qjb   jmp trap, 0

      dat 0,0
      dat 0,0

step  equ 7

top   dat 0,0
sb    spl #0,0
sp    nop   sb,  (step*4)
attk  mov   sb, >top
      mov  *-1, >top
      jmn.f -2, @top
      add.ab #step,sp
scan  jmz.f   -1, @sp  ;HSA-like scanner
      slt.b   sp, #18
      mov.b   sp,  top
      jmn.b attk,  sp
      add.b    3,   5  ;anti-imp clear
      mov    *-1, < 4
      jmp     -2,   0
      spl    # 5, 382
trap2 jmp    # 0,   0  ;protect CIA
      dat      0,   0

for 4
dat 0,0
rof

trap  spl trap2,  0
      spl   #0,   0    ;CIA will borrow this scanner
      mov   -1,  >tptr
      jmn.f -1,  @tptr
      sub   #9,   tptr
last  dat    0,   0

end qscan 
