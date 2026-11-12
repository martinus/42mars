;redcode-94
;name The Rescue Team
;author Christian Schmidt
;strategy KOFACOTO Round4:
;strategy vamp CIA to a secured place,
;strategy then kill the Evil Jedimps
;assert 1

fStep equ  100
Fix   equ  2523
step  equ  8
count equ  19
ptr   equ  (bomb-5)

org   strt

bomb: spl      #1,      {1
kill: mov      bomb,    <ptr
mptr: mov      >ptr,    >ptr
      jmn.f    kill,    >ptr
a:    add      #step+1, @mptr
scan: jmz.f    a,       <ptr
      slt      @mptr,   #btm-ptr+5+1
      djn      kill,    @mptr
      djn      a,       #count
btm:  jmp      a,       {kill
      dat      0,       0
trap: jmp      0,       0
fang: jmp      0,       150
strt: add.ab   #fStep,  fang
      jmz.f    strt,    @fang
      jmn.f    #0,      <fang 
      jmn.f    -1,      <fang
      add.ab   #Fix,    fang
      sub.ba   fang,    fang
      nop      {fang,   0
      mov.i    fang,    @fang
      jmp scan
