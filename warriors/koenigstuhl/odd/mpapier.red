;redcode-94-t lvalue
;name Modified papier
;author Joshua Hudson
;strategy Based on John Metcalf's 2365*2^2936+1 is prime!
;strategy added coreclear
;assert 1

  spl   0, -1
  mov.i @-1, <-1
  djn.f -1, <-1
  jmp   -1, <-1
o spl   -1, {-1
  spl   1
  spl   1,     }1
  mul   #1,    1
  spl   @0,    >1
  mov   }-1, >-1
  mov   <-1,   <-1
  mov.i #1,    1
end o

