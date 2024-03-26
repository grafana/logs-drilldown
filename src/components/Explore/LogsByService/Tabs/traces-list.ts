import { DataFrame, FieldType } from '@grafana/data';

export const tracesFrame: DataFrame = {
  refId: 'traces',
  length: 45,
  meta: {
    preferredVisualisationType: 'table',
  },
  name: 'Spans',
  fields: [
    {
      name: 'traceIdHidden',
      type: FieldType.string,
      config: {
        custom: {
          hidden: true,
        },
      },
      values: [
        '812464c8818908c6e49a4c4d2011c469',
        '81219644042cbe0bc6899ed39fa11a5a',
        '81219644042cbe0bc6899ed39fa11a5a',
        '81219644042cbe0bc6899ed39fa11a5a',
        '810c951d67bc06afc43013a162a85e63',
        '810c951d67bc06afc43013a162a85e63',
        '810c951d67bc06afc43013a162a85e63',
        '8106cca19bbf4a97264ff33d0a47b823',
        '8106cca19bbf4a97264ff33d0a47b823',
        '8109214cb649bf881a7a0850f0fafdad',
        '810d97c0808b73b7eee16150fa379b7d',
        '810fb17bdb5ddd858de954bf5a3394bf',
        '810fb17bdb5ddd858de954bf5a3394bf',
        '810fb17bdb5ddd858de954bf5a3394bf',
        '8121513fc8cf2a0cbda43741ef0c981d',
        '8121513fc8cf2a0cbda43741ef0c981d',
        '810d66cf8c75c7745304aad7d6b13495',
        '812774f1a575add3d03ffc0e7b572fcc',
        '812774f1a575add3d03ffc0e7b572fcc',
        '812774f1a575add3d03ffc0e7b572fcc',
        '81164ddd21dd3ebef10ed66931b67d3c',
        '81164ddd21dd3ebef10ed66931b67d3c',
        '81164ddd21dd3ebef10ed66931b67d3c',
        '812358a4d037a16578bae77cbd86a68d',
        '812358a4d037a16578bae77cbd86a68d',
        '812358a4d037a16578bae77cbd86a68d',
        '81055b15fd4a3039bfa96f276183510c',
        '8116f575d5cc7d8961d01d274b886ff8',
        '8116f575d5cc7d8961d01d274b886ff8',
        '8116f575d5cc7d8961d01d274b886ff8',
        '8106f6a37c714b2d7808462f23a6cd31',
        '8106f6a37c714b2d7808462f23a6cd31',
        '811b5eec7fe56565a64fbf4ee888dd83',
        '811b5eec7fe56565a64fbf4ee888dd83',
        '811b5eec7fe56565a64fbf4ee888dd83',
        '810e904a623dec659b1c3fe2db467c49',
        '810e904a623dec659b1c3fe2db467c49',
        '810e904a623dec659b1c3fe2db467c49',
        '810e757b5894d004cd705c6a84d404bb',
        '810e757b5894d004cd705c6a84d404bb',
        '810e757b5894d004cd705c6a84d404bb',
        '81093a2f8b0ec8c40c8e3172bc2edccc',
        '81093a2f8b0ec8c40c8e3172bc2edccc',
        '81093a2f8b0ec8c40c8e3172bc2edccc',
        '811e480c144fe334c9c16290abdfd409',
        '811e480c144fe334c9c16290abdfd409',
      ],
    },
    {
      name: 'traceService',
      type: FieldType.string,
      config: {
        displayNameFromDS: 'Service',
        custom: {
          width: 300,
        },
      },
      values: [
        'mimir-ingester',
        'mimir-ingester',
        'mimir-ingester',
        'mimir-ingester',
        'mimir-ingester',
        'mimir-ingester',
        'mimir-ingester',
        'mimir-ingester',
        'mimir-ingester',
        'mimir-ingester',
        'mimir-ingester',
        'mimir-ingester',
        'mimir-ingester',
        'mimir-ingester',
        'mimir-ingester',
        'mimir-ingester',
        'mimir-ingester',
        'mimir-ingester',
        'mimir-ingester',
        'mimir-ingester',
        'mimir-ingester',
        'mimir-ingester',
        'mimir-ingester',
        'mimir-ingester',
        'mimir-ingester',
        'mimir-ingester',
        'mimir-ingester',
        'mimir-ingester',
        'mimir-ingester',
        'mimir-ingester',
        'mimir-ingester',
        'mimir-ingester',
        'mimir-ingester',
        'mimir-ingester',
        'mimir-ingester',
        'mimir-ingester',
        'mimir-ingester',
        'mimir-ingester',
        'mimir-ingester',
        'mimir-ingester',
        'mimir-ingester',
        'mimir-ingester',
        'mimir-ingester',
        'mimir-ingester',
        'mimir-ingester',
        'mimir-ingester',
      ],
    },
    {
      name: 'spanID',
      type: FieldType.string,
      config: {
        unit: 'string',
        displayNameFromDS: 'Trace ID',
        custom: {
          width: 200,
        },
        links: [
          {
            title: 'Span: ${__value.raw}',
            url: '',
            internal: {
              datasourceUid: 'Em2icyuMk',
              datasourceName: 'Tempo (tempo-ops)',
              query: {
                query: '${__data.fields.traceIdHidden}',
                queryType: 'traceql',
              },
              panelsState: {
                trace: {
                  spanId: '${__value.raw}',
                },
              },
            },
          },
        ],
      },
      values: [
        '4acc78a2724e329c',
        '9c5359a63df66b8c',
        'd3745ec439df69e2',
        '7e445a2372da3d0b',
        '33dd5c80ae49f2ff',
        '248266d1550ad0cf',
        '4e88570ec63a9817',
        '8caddb38ea7c7bc4',
        '876da84b7d7e3d6c',
        'b2ed48a1d0c84e4e',
        '0b6a14e997a283e8',
        '12874f8e4805cf81',
        '72285938c63a7fa3',
        '514809d9ded14a37',
        '667188962de7c74c',
        '4a79a71ebe5f013a',
        '38d478c79ee3ae4b',
        '3f4cb84913da489e',
        '30584c79a4d9b3ca',
        '3fc389aaca673309',
        '4f00e56e8f7be324',
        '77682dd939bb130b',
        '48387d8be7425bf5',
        '4748aa632b2151a6',
        '1eeb49fb3415dc94',
        '3a224dd4f1ee1e48',
        '34d60ade573727fc',
        '27ffb861b87c91ab',
        '31276e1a626a1099',
        '5887a3a240648d63',
        '09ebd3210ccbb467',
        '3a814b061210f396',
        'e9acc4b0cab8f037',
        'e810a6ed57574743',
        '8a31863d890cbc56',
        'dbc85765ff2f2c1c',
        'c7714091d6d16e35',
        '16b8045b93c7d2d7',
        'eca74e78884153f3',
        '0def3efe63fd05f8',
        'a7b942bf3d55f437',
        '1998fe1941722abe',
        '5553bf20e4b191c2',
        '0682cc643bce6595',
        '60162bb9bf6b690b',
        '6009b1a28952cee1',
      ],
    },
    {
      name: 'time',
      type: FieldType.time,
      config: {
        displayNameFromDS: 'Start time',
      },
      values: [
        1709725400096.8381, 1709725390598.888, 1709725390598.9062, 1709725390599.9958, 1709725381176.527,
        1709725381185.433, 1709725381185.49, 1709725375664.892, 1709725375673.6953, 1709725370142.9226,
        1709725364620.6152, 1709725363473.0781, 1709725363471.296, 1709725363471.821, 1709725362453.5488,
        1709725362455.927, 1709725353449.6633, 1709725326131.9731, 1709725326132.03, 1709725326132.148,
        1709725270134.113, 1709725270134.207, 1709725270133.648, 1709725263350.336, 1709725263350.479,
        1709725263355.357, 1709725250370.584, 1709725246340.597, 1709725246340.623, 1709725246340.7202,
        1709725240106.6736, 1709725240002.7283, 1709725233308.6882, 1709725233308.839, 1709725233308.9915,
        1709725231529.0232, 1709725231529.0842, 1709725231529.1848, 1709725215588.4976, 1709725215592.8853,
        1709725215596.448, 1709725208100.883, 1709725208102.523, 1709725208101.102, 1709725166223.22, 1709725166224.904,
      ],
    },
    {
      name: 'status',
      type: FieldType.string,
      config: {
        displayNameFromDS: 'Errors',
      },
      values: [
        '3',
        '9',
        '16',
        '4',
        '7',
        '15',
        '0',
        '1',
        '0',
        '19',
        '3',
        '0',
        '8',
        '2',
        '17',
        '11',
        '13',
        '0',
        '0',
        '0',
        '0',
        '14',
        '12',
        '7',
        '18',
        '3',
        '4',
        '0',
        '19',
        '2',
        '0',
        '11',
        '0',
        '10',
        '8',
        '6',
        '13',
        '9',
        '15',
        '0',
        '14',
        '12',
        '0',
        '3',
        '18',
        '6',
      ],
    },
    {
      name: 'duration',
      type: FieldType.number,
      config: {
        displayNameFromDS: 'Duration',
        unit: 'ns',
        custom: {
          width: 120,
        },
      },
      values: [
        189368, 10093693505, 10093630104, 10093666014, 5158000, 686562000, 686594000, 18239740, 8683948, 121486,
        1668031, 3562000, 40599000, 55343000, 3906299, 239000, 863437, 1133000, 1070000, 573000, 6078000, 5996000,
        6648000, 2483000, 2372000, 38505000, 1465000, 442315000, 442335000, 442172000, 453202996, 571141576, 12165596,
        8662018, 7726828, 9634283, 7741930, 6277150, 21956998, 7799492, 3970597, 306234000, 304646000, 306093000,
        4522000, 2748000,
      ],
    },
  ],
};
