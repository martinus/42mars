;redcode
;name Stun Gun
;author Simon Wainwright
;strategy oneshot
;assert 1

          clearptr equ bombptr+1
          step equ -17
          gap equ -8
          first equ -323

clear     dat         <step,              <step
stun      spl             0,                -30

scanloop  add         clear,            scanptr
scanptr   cmp     first+gap,              first
          mov       scanptr,           clearptr
          jmz      scanloop,           clearptr

          spl             0
clearloop mov      @bombptr,          <clearptr
          mov      @bombptr,          <clearptr
          djn     clearloop,               <-15

bombptr   dat                             #stun

          end       scanptr

