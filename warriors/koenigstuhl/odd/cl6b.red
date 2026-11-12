;redcode
;name cl 6b
;author Michal Janeczek
;assert 1

ptr   equ   (start+13)

      djn.f #1   , }1
start mov   }ptr , }ptr
      mov   }ptr , }ptr
      mov   }ptr , }ptr
      mov   }ptr , }ptr
      djn.f -1   , }ptr
      jmp   -2   , }ptr
      djn.a #1   , >1

      end   start
