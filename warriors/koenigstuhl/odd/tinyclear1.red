;redcode-94x
;author Roy van Rijn
;name TinyClear1
;strategy Bit faster clear....with lenght!
;assert 1

start1   jmp  start17
start2   jmp  start17
start3   jmp  start17
start4   jmp  start17
start5   jmp  start17
start6   jmp  start17
start7   jmp  start17
start8   jmp  start17
start9   jmp  start17
start10  jmp  start17
start11  jmp  start17
start12  nop  0,15
start13  nop  0,0
start14  spl #0,>253
start15  mov nostart,>start12
start16  djn.f 1,>start12
start17  sub.a #2,-1
start18 mov start12,-1
start19 jmp start14
nostart dat <267,#15

end start1
