;redcode-94 test
;name Random Evolution 2801 20
;author Steve Gunnell
;assert 1

L0  MOV.I  {  3315, $ -3313
L1  SEQ.I  $  3208, $  3308
L2  JMN.B  $    -3, {   577
L3  JMZ.B  *     4, *     4
L4  MOV.I  $    10, <   -21
L5  MOV.I  $     1, >    -2
L6  DJN.F  $    -1, >    -4
L7  MOD.A  #     2, $     1

end L6

