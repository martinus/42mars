;redcode-94odd
;name Dirty Spl Clear
;author Christian Schmidt
;strategy d-clear with spl-bomb
;assert 1

gate   dat  0, 1800

for 6
dat 0, 0
rof

start  spl  #0, #0
       mov.i bomb, >gate
       mov.i bomb, >gate
       jmp -1, >gate
bomb   spl #0, 17

end start
