;redcode-94t
;name noname 0001
;author mj
;assert 1
;       CORESIZE==800

start6  mov 100,       0
start7  mov 100,       0
start8  mov 100,       0
start9  mov 100,       0
start10 mov 100,       0
start11 mov 100,       0
start12 mov 100,       0
start13 mov 100,       0
start14 mov 100,       0
start15 mov 100,       0
start16 mov 100,       0
start17 mov 100,       0
start18 mov 100,       0
start19 mov 100,       0

t       equ 242
step    equ 293

start1  spl #-2*step,  <-2*step
start2  mov nostart,   *start4
start3  sub start1,    start4
start4  mov -1-t*step, -1-(t-1)*step
start5  jmp -3,        <start1-2*step
nostart dat }1,        >1

end start1
