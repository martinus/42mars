;redcode
;name Kenshin (variant)1
;author steve Gunnell
;assert 1

STEP equ 569
START equ 569

start1 nop 0,0
start2  nop 0,0
start3  nop 0,0
start4  nop 0,0
start5  nop 0,0
start6  nop 0,0
start7  nop 0,0
start8  nop 0,0
start9  nop 0,0
start10 nop 0,0
start11  nop 200,0
start12  nop   0,        0
start13  slt   #START,   #14
start14  mov.a start13,  @start15
start15  mov.i *nostart, }start11
start16  add.a #STEP,    @start18
start17  jmz.f start15,  *start13
start18  jmn.a @start18, start13
start19  jmp  @start18, }nostart
nostart  spl  #0, {0

end  start1
