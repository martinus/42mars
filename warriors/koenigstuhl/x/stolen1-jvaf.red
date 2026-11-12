;redcode-94x
;name Stolen DX 92
;author Steve Gunnell
;strategy .75c scanner blended with a hyperclear.
;assert CORESIZE==55440

GAP   equ 3061
START equ 278
bptr  equ (ptr-1-3)
hptr  equ (back-1-6)
GAP1  equ 20
GAP2  equ 29
RPT   equ 5
HRPT  equ 3
BOOT  equ 4279
IMPNUM equ 27197

LEN   equ (tail-bptr+3)
HLEN  equ (tail-hptr+3)

ptr   dat    START      ,START+GAP+GAP
incr2 dat    GAP+GAP    ,GAP+GAP
incr1 dat    GAP        ,GAP    

      for GAP1
      dat    $0         ,$0
      rof

throw mov.i  wipe       ,>bptr

      for RPT
      mov    *throw     ,>bptr
      rof

      jmn.f  throw      ,@bptr
sgo   add.f  incr2      ,ptr
scan  sne.i  *ptr       ,@ptr
      add.f  incr1      ,ptr
      jmz.f  sgo        ,*ptr
      mov.ab ptr        ,bptr
      slt.b  bptr       ,#LEN
      jmp    throw      ,>bptr

; hyperclear launch
      jmn.f  #0         ,{xptr
      mov    <xptr      ,{xptr
      djn    -1         ,#tail-back+1
      spl    *xptr
      sub.f  xptr       ,xptr
xptr  dat    BOOT       ,tail+1
      
      for GAP2
      dat    $0         ,$0
      rof

back  nop    <hptr      ,<hptr
spray mov    wipe       ,>hptr

      for HRPT
      mov    *spray     ,>hptr
      rof

      jmn.f  spray      ,@hptr
hscan sne.i  >hptr      ,>hptr
      jmz.f  hscan      ,>hptr
      slt.b  @hscan     ,#HLEN
      jmp    back       ,<hptr
      add.ab #HLEN      ,@hscan
      jmp    hscan      ,}spray
wipe  spl    #0         ,}0
      spl #0, {0
      mov.i #0 ,1
      dat {IMPNUM+IMPNUM+1, >IMPNUM+IMPNUM+1
      mul.x <0, >0
tail  spl #0, {0

fDec  equ  (throw-3284)

      for   (MAXLENGTH-CURLINE-8)
      dat.f $0        , $0
      rof

fBlur mov   {fDec    , {fDec+2   ; protection against qscan
      mov   {fDec+1  , {fDec+4
      mov   {fDec+5  , {fDec+7
      mov   {fDec+8  , {fDec+12
      mov   {fDec+9  , {fDec+14
      mov   {fDec+15 , {fDec+17
      mov   {fDec+18 , {fDec+19
      jmp    scan+1  , }fDec+20

      end   fBlur
